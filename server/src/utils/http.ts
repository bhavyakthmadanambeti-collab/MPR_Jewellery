import type { NextFunction, Request, Response, RequestHandler } from 'express';

export class HttpError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (msg: string, details?: unknown) => new HttpError(400, msg, details);
export const notFound = (msg = 'Not found') => new HttpError(404, msg);
export const unauthorized = (msg = 'Please sign in to continue.') => new HttpError(401, msg);
export const forbidden = (msg = 'You do not have permission to do that.') => new HttpError(403, msg);

/** Wrap async route handlers so errors reach the error middleware */
export const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) =>
    fn(req, res, next).catch(next);

export function intParam(v: string | undefined, name = 'id'): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw badRequest(`Invalid ${name}`);
  return n;
}
