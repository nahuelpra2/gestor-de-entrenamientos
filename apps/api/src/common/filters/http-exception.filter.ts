import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'INTERNAL_ERROR';
    let message = 'Error interno del servidor';
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        error = (resp.error as string) ?? exception.name;
        message = (resp.message as string) ?? exception.message;
        details = resp.details;
      } else {
        message = exceptionResponse as string;
      }
    }

    response.status(status).json({
      statusCode: status,
      error,
      message,
      ...(details !== undefined && { details }),
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
