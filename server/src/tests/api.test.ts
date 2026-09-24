/**
 * End-to-end API tests for MPR JEWELLERY.
 * Run against a running server:  npm run dev  (in another terminal), then  npm test
 * Env: API_URL (default http://localhost:5000), OWNER_EMAIL, OWNER_PASSWORD
 * The test creates its own product/collection/order and deletes the product & collection afterwards.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT_DIR } from '../config/env.js';

const API = process.env.API_URL || 'http://localhost:5000';
const OWNER_EMAIL = process.env.OWNER_EMAIL || process.env.SEED_OWNER_EMAIL || '';
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || process.env.SEED_OWNER_PASSWORD || '';

let passed = 0;
let failed = 0;
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  \u2713 ${name}`);
  } catch (e: any) {
    failed++;
    console.log(`  \u2717 ${name}\n      ${e.message}`);
  }
}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}
async function call(method: string, p: string, body?: unknown, token?: string) {
  const isForm = body instanceof FormData;
  const res = await fetch(API + p, {
    method,
    headers: { ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? (isForm ? (body as FormData) : JSON.stringify(body)) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}
function fileForm(field: string, file: string, mime: string) {
  const fd = new FormData();
  fd.append(field, new Blob([fs.readFileSync(file)], { type: mime }), path.basename(file));
  return fd;
}

const seedImg = path.join(ROOT_DIR, 'storage', 'seed', 'p-gold-ring.png');
const seedVid = path.join(ROOT_DIR, 'storage', 'seed', 'showcase-video.mp4');

async function main() {
  assert(OWNER_EMAIL && OWNER_PASSWORD, 'Set OWNER_EMAIL / OWNER_PASSWORD (or SEED_OWNER_* in server/.env) to run tests.');
  console.log(`Testing ${API}\n`);
  let token = '';
  let productId = 0;
  let productSlug = '';
  let collectionId = 0;
  let orderNumber = '';
  let orderId = 0;
  let accessToken = '';
  let total = 0;

  console.log('Owner authentication');
  await test('invalid owner login is rejected', async () => {
    const r = await call('POST', '/api/owner/login', { email: OWNER_EMAIL, password: 'definitely-wrong' });
    assert(r.status === 401, `expected 401, got ${r.status}`);
  });
  await test('owner login succeeds and never returns the password hash', async () => {
    const r = await call('POST', '/api/owner/login', { email: OWNER_EMAIL, password: OWNER_PASSWORD });
    assert(r.status === 200 && r.data.token, `login failed: ${r.status} ${JSON.stringify(r.data)}`);
    assert(!JSON.stringify(r.data).includes('password'), 'response leaks password fields');
    token = r.data.token;
  });
  await test('owner routes require authentication', async () => {
    const r = await call('GET', '/api/owner/dashboard');
    assert(r.status === 401, `expected 401, got ${r.status}`);
  });

  console.log('\nProducts');
  await test('create product', async () => {
    const r = await call('POST', '/api/owner/products', { name: 'API Test Gold Ring', description: 'Test', category: 'rings', metalType: 'gold', purity: '22K (916)', weightGrams: 3.5, price: 42000, stock: 5, availability: 'in_stock', sku: `TEST-${Date.now()}` }, token);
    assert(r.status === 201, `expected 201, got ${r.status} ${JSON.stringify(r.data)}`);
    productId = r.data.id;
    productSlug = r.data.slug;
  });
  await test('upload product image (multipart, no URL entry)', async () => {
    const r = await call('POST', `/api/owner/products/${productId}/images`, fileForm('images', seedImg, 'image/png'), token);
    assert(r.status === 200 && r.data.images.length === 1, `upload failed: ${r.status} ${JSON.stringify(r.data)}`);
  });
  await test('reject unsupported image type', async () => {
    const fd = new FormData();
    fd.append('images', new Blob(['hello'], { type: 'text/plain' }), 'note.txt');
    const r = await call('POST', `/api/owner/products/${productId}/images`, fd, token);
    assert(r.status === 400, `expected 400, got ${r.status}`);
  });
  if (fs.existsSync(seedVid)) {
    await test('upload product video', async () => {
      const r = await call('POST', `/api/owner/products/${productId}/videos`, fileForm('videos', seedVid, 'video/mp4'), token);
      assert(r.status === 200 && r.data.videos.length === 1, `video upload failed: ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`);
    });
  }
  await test('edit product price', async () => {
    const r = await call('PUT', `/api/owner/products/${productId}`, { price: 43000 }, token);
    assert(r.status === 200 && r.data.price === 43000, `update failed: ${JSON.stringify(r.data)}`);
  });
  await test('public product browsing and search', async () => {
    const list = await call('GET', '/api/products?metal=gold');
    assert(list.status === 200 && list.data.items.length > 0, 'no gold products');
    const s = await call('GET', '/api/products?q=API%20Test');
    assert(s.data.items.some((p: any) => p.id === productId), 'search did not find test product');
    const one = await call('GET', `/api/products/${productSlug}`);
    assert(one.status === 200 && one.data.id === productId, 'product page failed');
  });

  console.log('\nHome collections');
  await test('create collection and upload media', async () => {
    const c = await call('POST', '/api/owner/collections', { title: 'API Test Collection', isPublished: true, showOnHome: true }, token);
    assert(c.status === 201, `create failed: ${c.status}`);
    collectionId = c.data.id;
    const m = await call('POST', `/api/owner/collections/${collectionId}/media`, fileForm('media', seedImg, 'image/png'), token);
    assert(m.status === 200 && m.data.media.length === 1, 'media upload failed');
  });
  await test('edit collection title (e.g. "New Collection" → "Festive Gold Collection")', async () => {
    const r = await call('PUT', `/api/owner/collections/${collectionId}`, { title: 'Festive Gold Collection (API test)' }, token);
    assert(r.status === 200 && r.data.title === 'Festive Gold Collection (API test)', 'title not updated');
    const pub = await call('GET', '/api/collections');
    assert(pub.data.some((c: any) => c.id === collectionId && c.title.startsWith('Festive Gold')), 'public list not updated');
  });

  console.log('\nCart, checkout & UPI');
  await test('cart quote is calculated by the server (client prices ignored)', async () => {
    const r = await call('POST', '/api/cart/quote', { items: [{ productId, quantity: 2, price: 1 }] });
    assert(r.status === 200 && r.data.subtotal === 86000, `unexpected subtotal ${r.data?.subtotal}`);
  });
  await test('checkout validation rejects bad phone/pincode', async () => {
    const r = await call('POST', '/api/orders', { items: [{ productId, quantity: 1 }], fullName: 'A', phone: '123', email: 'x', address: '', city: '', state: '', pincode: '1' });
    assert(r.status === 400, `expected 400, got ${r.status}`);
  });
  await test('order creation returns MPR-YYYYMMDD-NNNN id and UPI instructions', async () => {
    const r = await call('POST', '/api/orders', { items: [{ productId, quantity: 1 }], fullName: 'API Tester', phone: '9876543210', email: 'api@test.dev', address: '1 Test Street', city: 'Chennai', state: 'Tamil Nadu', pincode: '600001', totalAmount: 1 });
    assert(r.status === 201, `order failed: ${r.status} ${JSON.stringify(r.data)}`);
    orderNumber = r.data.order.orderNumber;
    orderId = r.data.order.id;
    accessToken = r.data.accessToken;
    total = r.data.order.totalAmount;
    assert(/^MPR-\d{8}-\d{4}$/.test(orderNumber), `bad order number ${orderNumber}`);
    assert(total >= 43000, 'client-sent total was trusted');
    const pay = r.data.paymentInstructions;
    assert(pay && pay.upiId && pay.upiLink.startsWith('upi://pay') && pay.upiLink.includes(`am=${total.toFixed(2)}`), 'UPI link missing server amount');
    assert(r.data.order.paymentStatus === 'awaiting_payment', 'payment must not be marked successful');
  });
  await test('order status requires the secure token or phone', async () => {
    const bad = await call('GET', `/api/orders/${orderNumber}`);
    assert([400, 401, 403, 404].includes(bad.status), `expected denial, got ${bad.status}`);
    const ok = await call('GET', `/api/orders/${orderNumber}?token=${accessToken}`);
    assert(ok.status === 200, 'token lookup failed');
    const byPhone = await call('GET', `/api/orders/${orderNumber}?phone=9876543210`);
    assert(byPhone.status === 200, 'phone lookup failed');
  });
  await test('customer "I have made the payment" → Pending Verification (not Paid)', async () => {
    const r = await call('POST', `/api/orders/${orderNumber}/confirm-payment`, { token: accessToken, reference: '412345678901' });
    assert(r.status === 200 && r.data.order.paymentStatus === 'pending_verification', `got ${r.data?.order?.paymentStatus}`);
  });

  console.log('\nOwner verification');
  await test('fulfilment is blocked until payment is verified', async () => {
    const r = await call('PUT', `/api/owner/orders/${orderId}/status`, { status: 'dispatched' }, token);
    assert(r.status === 400, `expected 400, got ${r.status}`);
  });
  await test('owner marks payment Paid → customer sees verified; audit record written', async () => {
    const r = await call('PUT', `/api/owner/orders/${orderId}/payment`, { status: 'paid', note: 'UTR matched (API test)' }, token);
    assert(r.status === 200 && r.data.order.paymentStatus === 'paid', 'mark paid failed');
    assert(r.data.history.some((h: any) => h.event === 'payment_status_changed' && h.to === 'paid'), 'audit log missing');
    const c = await call('GET', `/api/orders/${orderNumber}?token=${accessToken}`);
    assert(c.data.order.paymentStatus === 'paid', 'customer view not updated');
  });
  await test('owner updates order status', async () => {
    const r = await call('PUT', `/api/owner/orders/${orderId}/status`, { status: 'dispatched' }, token);
    assert(r.status === 200 && r.data.order.orderStatus === 'dispatched', 'status update failed');
  });

  console.log('\nContact messages & rates');
  let msgId = 0;
  await test('contact form saves message; owner can read/mark/delete', async () => {
    const r = await call('POST', '/api/messages', { name: 'API Tester', email: 'api@test.dev', phone: '9876543210', message: 'Test message from API tests' });
    assert(r.status === 201 || r.status === 200, `message failed ${r.status}`);
    const list = await call('GET', '/api/owner/messages', undefined, token);
    const m = list.data.find((x: any) => x.message === 'Test message from API tests');
    assert(m, 'message not listed');
    msgId = m.id;
    assert((await call('PUT', `/api/owner/messages/${msgId}`, { isRead: true }, token)).status === 200, 'mark read failed');
    assert((await call('DELETE', `/api/owner/messages/${msgId}`, undefined, token)).status === 200, 'delete failed');
  });
  await test('public rates show last updated and source', async () => {
    const r = await call('GET', '/api/rates');
    assert(r.status === 200 && r.data.rates.length >= 6 && r.data.lastUpdated && r.data.label, 'rates incomplete');
  });
  await test('settings reject UPI PIN / bank password fields', async () => {
    const r = await call('PUT', '/api/owner/settings', { payment: { upiPin: '1234' } }, token);
    assert(r.status === 400, `expected 400, got ${r.status}`);
  });

  console.log('\nCleanup');
  await test('delete test collection and product', async () => {
    assert((await call('DELETE', `/api/owner/collections/${collectionId}`, undefined, token)).status === 200, 'collection delete failed');
    assert((await call('DELETE', `/api/owner/products/${productId}`, undefined, token)).status === 200, 'product delete failed');
    const gone = await call('GET', `/api/products/${productSlug}`);
    assert(gone.status === 404, 'product still public');
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
