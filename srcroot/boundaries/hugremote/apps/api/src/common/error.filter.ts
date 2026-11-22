import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { ErrorCode } from '@app/shared';

const STATUS_CODE: Record<number, ErrorCode> = {
  400: ErrorCode.VALIDATION_FAILED,
  401: ErrorCode.UNAUTHORIZED,
  403: ErrorCode.FORBIDDEN,
  404: ErrorCode.NOT_FOUND,
  413: ErrorCode.UPLOAD_TOO_LARGE,
  429: ErrorCode.RATE_LIMITED,
};

/** Mọi lỗi ra ngoài theo một khuôn `{ code, message?, details? }` (G-3). Lỗi lạ → 500 INTERNAL, không lộ stack. */
@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly log = new Logger('ErrorFilter');

  catch(err: unknown, host: ArgumentsHost) {
    if (host.getType() !== 'http') return;
    const res = host.switchToHttp().getResponse<Response>();
    if (res.headersSent) return;
    if (err instanceof HttpException) {
      const status = err.getStatus();
      const body = err.getResponse() as Record<string, unknown> | string;
      if (typeof body === 'object' && body && typeof body.code === 'string') {
        return res.status(status).json(body);
      }
      const details = typeof body === 'object' && Array.isArray(body.message) ? { fields: body.message } : undefined;
      return res.status(status).json({ code: STATUS_CODE[status] ?? ErrorCode.INTERNAL, ...(details ? { details } : {}) });
    }
    this.log.error(err instanceof Error ? err.stack : String(err));
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ code: ErrorCode.INTERNAL });
  }
}
