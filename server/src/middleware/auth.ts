import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { forbidden, unauthorized } from '../utils/http.js';

export interface AuthPayload {
  sub: number;
  role: 'owner' | 'admin' | 'customer';
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export function signToken(payload: AuthPayload) {
  const expiresIn = payload.role === 'customer' ? env.jwtCustomerExpiry : env.jwtOwnerExpiry;
  return jwt.sign(payload, env.jwtSecret, { expiresIn: expiresIn as any, issuer: 'mpr-jewellery', audience: payload.role === 'customer' ? 'customer' : 'owner' });
}

function readToken(req: Request): AuthPayload | null {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, env.jwtSecret, { issuer: 'mpr-jewellery' }) as any;
    return { sub: Number(decoded.sub), role: decoded.role, email: decoded.email };
  } catch {
    return null;
  }
}

/** Server-side authorization for every owner/admin API */
export function requireOwner(req: Request, _res: Response, next: NextFunction) {
  const auth = readToken(req);
  if (!auth) return next(unauthorized('Your owner session has expired. Please sign in again.'));
  if (auth.role !== 'owner' && auth.role !== 'admin') return next(forbidden());
  req.auth = auth;
  next();
}

export function requireCustomer(req: Request, _res: Response, next: NextFunction) {
  const auth = readToken(req);
  if (!auth || auth.role !== 'customer') return next(unauthorized());
  req.auth = auth;
  next();
}

export function optionalCustomer(req: Request, _res: Response, next: NextFunction) {
  const auth = readToken(req);
  if (auth && auth.role === 'customer') req.auth = auth;
  next();
}
