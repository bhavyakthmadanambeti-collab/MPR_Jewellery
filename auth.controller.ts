import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../database/db.js';
import { signToken } from '../middleware/auth.js';
import { parse } from '../middleware/validate.js';
import { ah, badRequest, unauthorized } from '../utils/http.js';

const loginSchema = z.object({ email: z.string().trim().toLowerCase().email('Enter a valid email'), password: z.string().min(1, 'Password is required').max(200) });

// Constant-ish time: always run a bcrypt compare, even for unknown emails
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

export const ownerLogin = ah(async (req, res) => {
  const { email, password } = parse(loginSchema, req.body);
  const owner = await db.one('SELECT * FROM owners WHERE email = $1', [email]);
  const ok = await bcrypt.compare(password, owner?.password_hash || DUMMY_HASH);
  if (!owner || !ok) throw unauthorized('Invalid email or password.');
  await db.query('UPDATE owners SET last_login_at = now() WHERE id = $1', [owner.id]);
  const token = signToken({ sub: owner.id, role: owner.role, email: owner.email });
  res.json({ token, owner: { id: owner.id, email: owner.email, name: owner.name, role: owner.role } });
});

export const ownerMe = ah(async (req, res) => {
  const owner = await db.one('SELECT id, email, name, role, last_login_at FROM owners WHERE id = $1', [req.auth!.sub]);
  if (!owner) throw unauthorized();
  res.json({ owner });
});

const pwSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(200),
});

export const ownerChangePassword = ah(async (req, res) => {
  const { currentPassword, newPassword } = parse(pwSchema, req.body);
  const owner = await db.one('SELECT * FROM owners WHERE id = $1', [req.auth!.sub]);
  if (!owner || !(await bcrypt.compare(currentPassword, owner.password_hash))) throw badRequest('Current password is incorrect.');
  if (currentPassword === newPassword) throw badRequest('New password must be different from the current password.');
  const hash = await bcrypt.hash(newPassword, 12);
  await db.query('UPDATE owners SET password_hash = $1, updated_at = now() WHERE id = $2', [hash, owner.id]);
  res.json({ ok: true, message: 'Password updated successfully.' });
});

// ---------- customers ----------
const registerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(100),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
});

const mapCustomer = (c: any) => ({ id: c.id, name: c.name, email: c.email, phone: c.phone });

export const customerRegister = ah(async (req, res) => {
  const input = parse(registerSchema, req.body);
  const exists = await db.one('SELECT id FROM customers WHERE email = $1', [input.email]);
  if (exists) throw badRequest('An account with this email already exists. Please sign in.');
  const hash = await bcrypt.hash(input.password, 12);
  const c = await db.one('INSERT INTO customers (name, email, phone, password_hash) VALUES ($1,$2,$3,$4) RETURNING *', [input.name, input.email, input.phone, hash]);
  res.status(201).json({ token: signToken({ sub: c!.id, role: 'customer', email: c!.email }), customer: mapCustomer(c) });
});

export const customerLogin = ah(async (req, res) => {
  const { email, password } = parse(loginSchema, req.body);
  const c = await db.one('SELECT * FROM customers WHERE email = $1', [email]);
  const ok = await bcrypt.compare(password, c?.password_hash || DUMMY_HASH);
  if (!c || !ok) throw unauthorized('Invalid email or password.');
  res.json({ token: signToken({ sub: c.id, role: 'customer', email: c.email }), customer: mapCustomer(c) });
});

export const customerMe = ah(async (req, res) => {
  const c = await db.one('SELECT * FROM customers WHERE id = $1', [req.auth!.sub]);
  if (!c) throw unauthorized();
  const addresses = await db.query('SELECT * FROM customer_addresses WHERE customer_id = $1 ORDER BY is_default DESC, id DESC', [c.id]);
  res.json({
    customer: mapCustomer(c),
    addresses: addresses.map((a) => ({ id: a.id, fullName: a.full_name, phone: a.phone, address: a.address, city: a.city, state: a.state, pincode: a.pincode, isDefault: a.is_default })),
  });
});

const profileSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
});

export const customerUpdateProfile = ah(async (req, res) => {
  const input = parse(profileSchema, req.body);
  const c = await db.one('UPDATE customers SET name = $1, phone = $2, updated_at = now() WHERE id = $3 RETURNING *', [input.name, input.phone, req.auth!.sub]);
  res.json({ customer: mapCustomer(c) });
});

export const addressSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter full name').max(100),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  address: z.string().trim().min(5, 'Enter your address').max(400),
  city: z.string().trim().min(2, 'Enter city').max(80),
  state: z.string().trim().min(2, 'Enter state').max(80),
  pincode: z.string().trim().regex(/^\d{6}$/, 'Enter a valid 6-digit pincode'),
  isDefault: z.boolean().optional(),
});

export const customerSaveAddress = ah(async (req, res) => {
  const a = parse(addressSchema, req.body);
  const id = req.params.id ? Number(req.params.id) : null;
  if (a.isDefault) await db.query('UPDATE customer_addresses SET is_default = false WHERE customer_id = $1', [req.auth!.sub]);
  if (id) {
    await db.query(
      'UPDATE customer_addresses SET full_name=$1, phone=$2, address=$3, city=$4, state=$5, pincode=$6, is_default=coalesce($7,is_default) WHERE id=$8 AND customer_id=$9',
      [a.fullName, a.phone, a.address, a.city, a.state, a.pincode, a.isDefault ?? null, id, req.auth!.sub]
    );
  } else {
    await db.query('INSERT INTO customer_addresses (customer_id, full_name, phone, address, city, state, pincode, is_default) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [
      req.auth!.sub, a.fullName, a.phone, a.address, a.city, a.state, a.pincode, a.isDefault ?? false,
    ]);
  }
  res.json({ ok: true });
});

export const customerDeleteAddress = ah(async (req, res) => {
  await db.query('DELETE FROM customer_addresses WHERE id = $1 AND customer_id = $2', [Number(req.params.id), req.auth!.sub]);
  res.json({ ok: true });
});
