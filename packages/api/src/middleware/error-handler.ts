import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { isTraceError } from '@trace/core';

export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  // Known application errors
  if (isTraceError(error)) {
    void reply.status(error.statusCode).send({
      success: false,
      error: { code: error.code, message: error.message },
    });
    return;
  }

  // Zod validation errors (from manual .parse() calls)
  if (error instanceof ZodError) {
    void reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        issues: error.errors,
      },
    });
    return;
  }

  // Fastify built-in errors (route not found, method not allowed, etc.)
  const statusCode = 'statusCode' in error && typeof error.statusCode === 'number'
    ? error.statusCode
    : 500;

  if (statusCode < 500) {
    void reply.status(statusCode).send({
      success: false,
      error: { code: 'REQUEST_ERROR', message: error.message },
    });
    return;
  }

  // Unexpected server errors — log and return generic message
  request.log.error({ err: error }, 'Unhandled error');
  void reply.status(500).send({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  });
}
