import { db, type Queryable } from '../database/db.js';
import { badRequest } from '../utils/http.js';
import { toPaise, toRupees } from '../utils/money.js';
import { getSettings } from './settings.service.js';

export interface CartLine {
  productId: number;
  quantity: number;
}

/**
 * Server-side price calculation. Prices ALWAYS come from the database —
 * any price/total sent by the browser is ignored.
 */
export async function quote(lines: CartLine[], q: Queryable = db, opts: { lock?: boolean; settings?: Awaited<ReturnType<typeof getSettings>> } = {}) {
  if (!Array.isArray(lines) || !lines.length) throw badRequest('Your cart is empty.');
  // merge duplicate lines
  const merged = new Map<number, number>();
  for (const l of lines) merged.set(l.productId, (merged.get(l.productId) || 0) + l.quantity);

  const ids = [...merged.keys()];
  const rows = await q.query(
    `SELECT p.*, (SELECT thumb_path FROM product_images i WHERE i.product_id = p.id ORDER BY sort_order, id LIMIT 1) AS thumb_path,
            (SELECT storage_driver FROM product_images i WHERE i.product_id = p.id ORDER BY sort_order, id LIMIT 1) AS storage_driver
       FROM products p WHERE p.id = ANY($1::int[]) ${opts.lock ? 'FOR UPDATE OF p' : ''}`,
    [ids]
  );
  // Settings must be read before/outside a transaction (embedded PGlite is single-connection).
  const settings = opts.settings ?? (await getSettings());
  const items = ids.map((id) => {
    const p = rows.find((r) => r.id === id);
    const quantity = merged.get(id)!;
    if (!p || !p.is_active) throw badRequest('One of the products in your cart is no longer available.');
    if (p.availability === 'out_of_stock') throw badRequest(`"${p.name}" is currently unavailable.`);
    if (p.availability === 'in_stock' && p.stock < quantity) {
      throw badRequest(p.stock > 0 ? `Only ${p.stock} of "${p.name}" left in stock.` : `"${p.name}" is currently unavailable.`);
    }
    const unitPaise = toPaise(p.price);
    return { product: p, quantity, unitPaise, linePaise: unitPaise * quantity };
  });

  const subtotalPaise = items.reduce((s, i) => s + i.linePaise, 0);
  const { flatCharge, freeAbove } = settings.commerce.delivery;
  const deliveryPaise = freeAbove > 0 && subtotalPaise >= toPaise(freeAbove) ? 0 : toPaise(flatCharge);
  const tax = settings.commerce.tax;
  let taxPaise = 0;
  if (tax.mode === 'exclusive') taxPaise = Math.round((subtotalPaise * tax.ratePercent) / 100);
  if (tax.mode === 'inclusive') taxPaise = Math.round(subtotalPaise - subtotalPaise / (1 + tax.ratePercent / 100)); // informational
  const totalPaise = subtotalPaise + deliveryPaise + (tax.mode === 'exclusive' ? taxPaise : 0);

  return {
    currency: settings.commerce.currency,
    items: items.map((i) => ({
      productId: i.product.id,
      slug: i.product.slug,
      name: i.product.name,
      sku: i.product.sku,
      purity: i.product.purity,
      weightGrams: Number(i.product.weight_grams),
      availability: i.product.availability,
      stock: i.product.stock,
      thumbPath: i.product.thumb_path,
      storageDriver: i.product.storage_driver,
      unitPrice: toRupees(i.unitPaise),
      quantity: i.quantity,
      lineTotal: toRupees(i.linePaise),
    })),
    subtotal: toRupees(subtotalPaise),
    delivery: toRupees(deliveryPaise),
    freeDeliveryAbove: freeAbove,
    tax: { mode: tax.mode, ratePercent: tax.ratePercent, label: tax.label, amount: toRupees(taxPaise) },
    total: toRupees(totalPaise),
  };
}
