import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError, sendError } from '../utils/apiResponse';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): Response {
  if (err instanceof AppError) {
    return sendError(res, err.statusCode, err.code, err.message, err.details);
  }

  if (err instanceof ZodError) {
    const fieldErrors = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    const firstMessage = fieldErrors[0]?.message || 'Please check your input.';
    return sendError(res, 400, 'VALIDATION_ERROR', firstMessage, fieldErrors);
  }

  if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
    return sendError(res, 409, 'DUPLICATE_RESOURCE', 'A resource with those unique values already exists.');
  }

  // Never leak stack traces, database internals, or credentials to the client
  return sendError(
    res,
    500,
    'INTERNAL_SERVER_ERROR',
    'An unexpected server error occurred. Please try again later.'
  );
}
