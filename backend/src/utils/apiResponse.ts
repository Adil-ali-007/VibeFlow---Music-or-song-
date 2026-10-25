import { Response } from 'express';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): Response {
  return res.status(statusCode).json({
    success: true,
    data,
  });
}

export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown
): Response {
  const errorPayload: Record<string, unknown> = { code, message };
  if (details !== undefined) {
    errorPayload.details = details;
  }
  return res.status(statusCode).json({
    success: false,
    error: errorPayload,
  });
}
