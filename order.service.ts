import crypto from 'node:crypto';
import { db, type Queryable } from '../database/db.js';
import { mapOrder, type OrderStatus, type PaymentStatus } from '../models/mappers.js';
import { badRequest, notFound, forbidden } from '../utils/http.js';
import { quote, type CartLine } from './pricing.service.js';
import { getSettings } from './settings.service.js';
import { getProvider } from './payments/index.js';

export interface CheckoutInput {
  items: CartLine[];
  fullName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  saveAddress?: boolean;
}

function istDateKey(d = new Date()) {
  const ist = new Date(d.getTime() + 5.5 * 3600 * 1000);
  return ist.toISOString().slice(0, 10).replace(/-/g, '');
}

async function nextOrderNumber(tx: Queryable) {
  const day = istDateKey();
  const r = await tx.query<{ seq: number }>(
    `INSERT INTO order_counters (day, seq) VALUES ($1, 1)
     ON CONFLICT (day) DO UPDATE SET seq = order_counters.seq + 1 RETURNING seq`,
    [day]
  );
  return `MPR-${day}-${String(r[0].seq).padStart(4, '0')}`;
}

async function audit(tx: Queryable, e: { orderId: number; paymentId?: number | null; event: string; from?: string | null; to?: string | null; actorType: 'customer' | 'owner' | 'system' | 'gateway'; actorId?: number | null; note?: string | null }) {
  await tx.query(
    `INSERT INTO payment_audit_log (order_id, payment_id, event, from_status, to_status, actor_type, actor_id, note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [e.orderId, e.paymentId ?? null, e.event, e.from ?? null, e.to ?? null, e.actorType, e.actorId ?? null, e.note ?? null]
  );
}

/** Creates an order. Every amount is computed server-side from DB prices. */
export async function createOrder(input: CheckoutInput, customerId?: number) {
  const settings = await getSettings();
  const result = await db.transaction(async (tx) => {
    const q = await quote(input.items, tx, { lock: true, settings });
    const orderNumber = await nextOrderNumber(tx);
    const accessToken = crypto.randomBytes(24).toString('hex');
    const taxAdded = q.tax.mode === 'exclusive' ? q.tax.amount : 0;
    const [order] = await tx.query(
      `INSERT INTO orders (order_number, access_token, customer_id, customer_name, phone, email, address, city, state, pincode,
                           currency, subtotal, delivery_charge, tax_amount, tax_mode, total_amount, payment_method, payment_status, order_status, upi_id_snapshot)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'upi','awaiting_payment','placed',$17) RETURNING *`,
      [orderNumber, accessToken, customerId ?? null, input.fullName.trim(), input.phone.trim(), input.email.trim().toLowerCase(), input.address.trim(), input.city.trim(), input.state.trim(), input.pincode.trim(),
       q.currency, q.subtotal, q.delivery, q.tax.amount, q.tax.mode, q.total, settings.payment.upiId]
    );
    for (const it of q.items) {
      await tx.query(
        `INSERT INTO order_items (order_id, product_id, product_name, sku, purity, weight_grams, unit_price, quantity, line_total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [order.id, it.productId, it.name, it.sku, it.purity, it.weightGrams, it.unitPrice, it.quantity, it.lineTotal]
      );
      if (it.availability === 'in_stock') {
        await tx.query('UPDATE products SET stock = stock - $1, availability = CASE WHEN stock - $1 <= 0 THEN \'out_of_stock\' ELSE availability END, updated_at = now() WHERE id = $2', [it.quantity, it.productId]);
      }
    }
    const [payment] = await tx.query(
      `INSERT INTO payments (order_id, amount, method, provider, status) VALUES ($1,$2,'upi',$3,'awaiting_payment') RETURNING id`,
      [order.id, q.total, getProvider().name]
    );
    await audit(tx, { orderId: order.id, paymentId: payment.id, event: 'order_created', to: 'awaiting_payment', actorType: customerId ? 'customer' : 'system', actorId: customerId ?? null, note: `Total ₹${q.total} (server calculated)` });
    void taxAdded;

    if (customerId && input.saveAddress) {
      const exists = await tx.query('SELECT id FROM customer_addresses WHERE customer_id = $1 AND address = $2 AND pincode = $3', [customerId, input.address.trim(), input.pincode.trim()]);
      if (!exists.length) {
        await tx.query('UPDATE customer_addresses SET is_default = false WHERE customer_id = $1', [customerId]);
        await tx.query(
          `INSERT INTO customer_addresses (customer_id, full_name, phone, address, city, state, pincode, is_default) VALUES ($1,$2,$3,$4,$5,$6,$7,true)`,
          [customerId, input.fullName.trim(), input.phone.trim(), input.address.trim(), input.city.trim(), input.state.trim(), input.pincode.trim()]
        );
      }
    }
    return { orderNumber, accessToken };
  });
  return result;
}

async function loadOrder(where: string, params: unknown[]) {
  const o = await db.one(`SELECT * FROM orders WHERE ${where}`, params);
  if (!o) return null;
  const [items, payment] = await Promise.all([
    db.query(
      `SELECT oi.*, p.slug AS product_slug,
              (SELECT thumb_path FROM product_images i WHERE i.product_id = oi.product_id ORDER BY sort_order, id LIMIT 1) AS thumb_path,
              (SELECT storage_driver FROM product_images i WHERE i.product_id = oi.product_id ORDER BY sort_order, id LIMIT 1) AS storage_driver
         FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = $1 ORDER BY oi.id`,
      [o.id]
    ),
    db.one(
      `SELECT pay.*, ow.email AS verified_by_email FROM payments pay LEFT JOIN owners ow ON ow.id = pay.verified_by
        WHERE pay.order_id = $1 ORDER BY pay.id DESC LIMIT 1`,
      [o.id]
    ),
  ]);
  return { raw: o, order: mapOrder(o, items, payment) };
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/** Public order lookup — requires the secret access token OR matching phone number, or ownership */
export async function getOrderForCustomer(orderNumber: string, opts: { token?: string; phone?: string; customerId?: number }) {
  const found = await loadOrder('order_number = $1', [orderNumber.trim().toUpperCase()]);
  const genericErr = notFound('We could not find an order with those details.');
  if (!found) throw genericErr;
  const { raw, order } = found;
  const phoneOk = opts.phone && raw.phone.replace(/\D/g, '').slice(-10) === opts.phone.replace(/\D/g, '').slice(-10);
  const tokenOk = opts.token && safeEqual(opts.token, raw.access_token);
  const ownerOk = opts.customerId && raw.customer_id === opts.customerId;
  if (!phoneOk && !tokenOk && !ownerOk) throw genericErr;
  const payment = ['awaiting_payment', 'failed'].includes(order.paymentStatus) ? await getProvider().instructions(order) : null;
  const history = await db.query(
    `SELECT event, to_status, actor_type, created_at FROM payment_audit_log WHERE order_id = $1 ORDER BY created_at, id`,
    [raw.id]
  );
  return { order, accessToken: raw.access_token as string, paymentInstructions: payment, history };
}

/** Customer says "I have made the payment" — moves to PENDING VERIFICATION only. Never marks paid. */
export async function confirmPayment(orderNumber: string, opts: { token?: string; phone?: string; customerId?: number; reference?: string }) {
  const { order } = await getOrderForCustomer(orderNumber, opts);
  if (order.paymentStatus === 'paid') throw badRequest('This order has already been verified as paid.');
  if (order.paymentStatus === 'cancelled' || order.orderStatus === 'cancelled') throw badRequest('This order has been cancelled.');
  if (order.paymentStatus === 'pending_verification') return getOrderForCustomer(orderNumber, opts);

  await db.transaction(async (tx) => {
    const [pay] = await tx.query(
      `UPDATE payments SET status = 'pending_verification', customer_confirmed_at = now(), customer_reference = $2, updated_at = now()
        WHERE id = (SELECT id FROM payments WHERE order_id = $1 ORDER BY id DESC LIMIT 1) RETURNING id`,
      [order.id, opts.reference?.trim() || null]
    );
    await tx.query(`UPDATE orders SET payment_status = 'pending_verification', updated_at = now() WHERE id = $1`, [order.id]);
    await audit(tx, { orderId: order.id, paymentId: pay?.id, event: 'customer_confirmed_payment', from: order.paymentStatus, to: 'pending_verification', actorType: 'customer', actorId: opts.customerId ?? null, note: opts.reference ? `Customer reference: ${opts.reference}` : null });
  });
  return getOrderForCustomer(orderNumber, opts);
}

// ---------------- Owner ----------------
export async function listOrders(f: { q?: string; paymentStatus?: string; orderStatus?: string; limit?: number; offset?: number }) {
  const where: string[] = [];
  const p: unknown[] = [];
  if (f.q) {
    p.push(`%${f.q}%`);
    where.push(`(o.order_number ILIKE $${p.length} OR o.customer_name ILIKE $${p.length} OR o.phone ILIKE $${p.length} OR o.email ILIKE $${p.length})`);
  }
  if (f.paymentStatus) {
    p.push(f.paymentStatus);
    where.push(`o.payment_status = $${p.length}`);
  }
  if (f.orderStatus) {
    p.push(f.orderStatus);
    where.push(`o.order_status = $${p.length}`);
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.min(f.limit ?? 50, 200);
  const rows = await db.query(
    `SELECT o.*, (SELECT string_agg(product_name || ' × ' || quantity, ', ') FROM order_items WHERE order_id = o.id) AS item_summary,
            (SELECT sum(quantity) FROM order_items WHERE order_id = o.id) AS item_count
       FROM orders o ${w} ORDER BY o.created_at DESC, o.id DESC LIMIT ${limit} OFFSET ${Math.max(f.offset ?? 0, 0)}`,
    p
  );
  const total = await db.one<{ c: number }>(`SELECT count(*)::int AS c FROM orders o ${w}`, p);
  return { items: rows.map((r) => mapOrder(r)), total: total?.c ?? 0 };
}

export async function getOrderForOwner(id: number) {
  const found = await loadOrder('id = $1', [id]);
  if (!found) throw notFound('Order not found.');
  const [history, payments] = await Promise.all([
    db.query(
      `SELECT l.*, ow.email AS owner_email FROM payment_audit_log l LEFT JOIN owners ow ON l.actor_type = 'owner' AND ow.id = l.actor_id
        WHERE l.order_id = $1 ORDER BY l.created_at, l.id`,
      [id]
    ),
    db.query(`SELECT pay.*, ow.email AS verified_by_email FROM payments pay LEFT JOIN owners ow ON ow.id = pay.verified_by WHERE order_id = $1 ORDER BY id`, [id]),
  ]);
  return {
    order: found.order,
    history: history.map((h) => ({ event: h.event, from: h.from_status, to: h.to_status, actorType: h.actor_type, actor: h.owner_email, note: h.note, at: h.created_at })),
    payments: payments.map((p) => ({ id: p.id, amount: Number(p.amount), status: p.status, provider: p.provider, customerReference: p.customer_reference, customerConfirmedAt: p.customer_confirmed_at, verifiedAt: p.verified_at, verifiedBy: p.verified_by_email, ownerNote: p.owner_note })),
  };
}

async function restoreStock(tx: Queryable, orderId: number) {
  const o = (await tx.query('SELECT stock_restored FROM orders WHERE id = $1', [orderId]))[0];
  if (!o || o.stock_restored) return;
  const items = await tx.query('SELECT product_id, quantity FROM order_items WHERE order_id = $1 AND product_id IS NOT NULL', [orderId]);
  for (const it of items) {
    await tx.query(`UPDATE products SET stock = stock + $1, availability = CASE WHEN availability = 'out_of_stock' THEN 'in_stock' ELSE availability END WHERE id = $2 AND availability <> 'made_to_order'`, [it.quantity, it.product_id]);
  }
  await tx.query('UPDATE orders SET stock_restored = true WHERE id = $1', [orderId]);
}

/** Owner manually sets payment status after checking bank/UPI records. */
export async function setPaymentStatus(orderId: number, status: Exclude<PaymentStatus, 'awaiting_payment'> | 'pending_verification', ownerId: number, note?: string, actorType: 'owner' | 'gateway' = 'owner', providerRef?: string) {
  const o = await db.one('SELECT * FROM orders WHERE id = $1', [orderId]);
  if (!o) throw notFound('Order not found.');
  if (o.payment_status === status) return getOrderForOwner(orderId);
  if (o.order_status === 'delivered' && status !== 'paid') throw badRequest('Delivered orders cannot change payment status.');
  await db.transaction(async (tx) => {
    const verified = status === 'paid' || status === 'failed';
    const [pay] = await tx.query(
      `UPDATE payments SET status = $2, verified_at = CASE WHEN $3 THEN now() ELSE verified_at END,
              verified_by = CASE WHEN $3 THEN $4::int ELSE verified_by END, owner_note = coalesce($5, owner_note),
              provider_reference = coalesce($6, provider_reference), updated_at = now()
        WHERE id = (SELECT id FROM payments WHERE order_id = $1 ORDER BY id DESC LIMIT 1) RETURNING id`,
      [orderId, status, verified, actorType === 'owner' ? ownerId : null, note || null, providerRef || null]
    );
    let orderStatus: OrderStatus = o.order_status;
    if (status === 'cancelled') orderStatus = 'cancelled';
    if (status === 'paid' && o.order_status === 'placed') orderStatus = 'processing';
    await tx.query('UPDATE orders SET payment_status = $2, order_status = $3, updated_at = now() WHERE id = $1', [orderId, status, orderStatus]);
    if (status === 'cancelled' || status === 'failed') await restoreStock(tx, orderId);
    await audit(tx, { orderId, paymentId: pay?.id, event: 'payment_status_changed', from: o.payment_status, to: status, actorType, actorId: actorType === 'owner' ? ownerId : null, note: note || null });
    if (orderStatus !== o.order_status) {
      await audit(tx, { orderId, event: 'order_status_changed', from: o.order_status, to: orderStatus, actorType, actorId: actorType === 'owner' ? ownerId : null, note: 'Automatic after payment update' });
    }
  });
  return getOrderForOwner(orderId);
}

const FULFILMENT: OrderStatus[] = ['processing', 'ready', 'dispatched', 'delivered'];

export async function setOrderStatus(orderId: number, status: OrderStatus, ownerId: number, note?: string) {
  const o = await db.one('SELECT * FROM orders WHERE id = $1', [orderId]);
  if (!o) throw notFound('Order not found.');
  if (o.order_status === status) return getOrderForOwner(orderId);
  if (FULFILMENT.includes(status) && o.payment_status !== 'paid') {
    throw badRequest('Verify the payment (mark as Paid) before moving the order to processing or delivery.');
  }
  if (o.order_status === 'cancelled') throw badRequest('Cancelled orders cannot be reopened. Ask the customer to place a new order.');
  await db.transaction(async (tx) => {
    await tx.query('UPDATE orders SET order_status = $2, updated_at = now() WHERE id = $1', [orderId, status]);
    if (status === 'cancelled') {
      if (o.payment_status !== 'paid') {
        await tx.query(`UPDATE orders SET payment_status = 'cancelled' WHERE id = $1`, [orderId]);
        await tx.query(`UPDATE payments SET status = 'cancelled', updated_at = now() WHERE order_id = $1 AND status <> 'paid'`, [orderId]);
      }
      await restoreStock(tx, orderId);
    }
    await audit(tx, { orderId, event: 'order_status_changed', from: o.order_status, to: status, actorType: 'owner', actorId: ownerId, note: note || null });
  });
  return getOrderForOwner(orderId);
}

export async function listCustomerOrders(customerId: number) {
  const rows = await db.query(
    `SELECT o.*, (SELECT string_agg(product_name || ' × ' || quantity, ', ') FROM order_items WHERE order_id = o.id) AS item_summary
       FROM orders o WHERE customer_id = $1 ORDER BY created_at DESC`,
    [customerId]
  );
  return rows.map((r) => mapOrder(r));
}

export function assertOwnerRole(role?: string) {
  if (role !== 'owner' && role !== 'admin') throw forbidden();
}
