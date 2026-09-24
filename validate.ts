import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import { badRequest } from '../utils/http.js';

export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const r = schema.safeParse(data);
  if (!r.success) {
    const first = r.error.issues[0];
    const field = first?.path.join('.') || 'input';
    throw badRequest(first ? `${prettyField(field)}: ${first.message}` : 'Invalid input', r.error.flatten());
  }
  return r.data;
}

function prettyField(f: string) {
  return f.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

export const body =
  <S extends ZodTypeAny>(schema: S) =>
  (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = parse(schema, req.body);
      next();
    } catch (e) {
      next(e);
    }
  };

export { ZodError };
