import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodSchema } from 'zod';
import { validationError } from '../http/errors';

export interface ValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

function formatIssues(error: ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}

/**
 * Validates and REPLACES the request parts with the parsed result, so handlers
 * get coerced, trimmed, typed values rather than raw strings.
 *
 *   router.post('/', validate({ body: createEmployeeSchema }), handler)
 */
export function validate(schemas: ValidationSchemas) {
  return function validateRequest(req: Request, _res: Response, next: NextFunction): void {
    try {
      if (schemas.params) {
        Object.assign(req.params, schemas.params.parse(req.params));
      }
      if (schemas.query) {
        const parsed = schemas.query.parse(req.query) as Record<string, unknown>;
        // req.query is a getter in Express - mutate in place.
        for (const key of Object.keys(req.query)) {
          delete (req.query as Record<string, unknown>)[key];
        }
        Object.assign(req.query, parsed);
      }
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(validationError('Request validation failed', formatIssues(error)));
        return;
      }
      next(error);
    }
  };
}
