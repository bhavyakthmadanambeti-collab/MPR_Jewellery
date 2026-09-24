import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as c from '../controllers/public.controller.js';
import * as auth from '../controllers/auth.controller.js';
import { optionalCustomer, requireCustomer } from '../middleware/auth.js';

const r = Router();
const writeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests. Please wait a few minutes and try again.' } });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many sign-in attempts. Please try again in 15 minutes.' } });

r.get('/settings', c.getPublicSettings);
r.get('/rates', c.getRates);
r.get('/home', c.getHome);
r.get('/products', c.listProducts);
r.get('/products/:slug', c.getProduct);
r.get('/collections', c.listCollections);
r.get('/collections/:slug', c.getCollection);

r.post('/cart/quote', c.cartQuote);
r.post('/orders', writeLimiter, optionalCustomer, c.createOrder);
r.get('/orders/:orderNumber', optionalCustomer, c.getOrderStatus);
r.post('/orders/:orderNumber/confirm-payment', writeLimiter, optionalCustomer, c.confirmPayment);
r.post('/messages', writeLimiter, c.sendMessage);
r.post('/payments/webhook/:provider', c.paymentWebhook);

// customer accounts
r.post('/customers/register', loginLimiter, auth.customerRegister);
r.post('/customers/login', loginLimiter, auth.customerLogin);
r.get('/customers/me', requireCustomer, auth.customerMe);
r.put('/customers/me', requireCustomer, auth.customerUpdateProfile);
r.get('/customers/me/orders', requireCustomer, c.customerOrders);
r.post('/customers/me/addresses', requireCustomer, auth.customerSaveAddress);
r.put('/customers/me/addresses/:id', requireCustomer, auth.customerSaveAddress);
r.delete('/customers/me/addresses/:id', requireCustomer, auth.customerDeleteAddress);

// owner auth (public endpoint, rate limited)
r.post('/owner/login', loginLimiter, auth.ownerLogin);

export default r;
