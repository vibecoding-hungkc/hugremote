import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@app/shared';

/** Lỗi nghiệp vụ theo khuôn `{ code, message?, details? }` (G-3). `message` chỉ cho dev, không cho người đọc. */
export class AppError extends HttpException {
  constructor(
    readonly code: ErrorCode,
    status: HttpStatus,
    readonly details?: Record<string, unknown>,
    message?: string,
  ) {
    super({ code, ...(message ? { message } : {}), ...(details ? { details } : {}) }, status);
  }

  static badRequest(code: ErrorCode, details?: Record<string, unknown>) {
    return new AppError(code, HttpStatus.BAD_REQUEST, details);
  }
  static unauthorized(code: ErrorCode = ErrorCode.UNAUTHORIZED, details?: Record<string, unknown>) {
    return new AppError(code, HttpStatus.UNAUTHORIZED, details);
  }
  static forbidden(code: ErrorCode = ErrorCode.FORBIDDEN, details?: Record<string, unknown>) {
    return new AppError(code, HttpStatus.FORBIDDEN, details);
  }
  static notFound(code: ErrorCode = ErrorCode.NOT_FOUND, details?: Record<string, unknown>) {
    return new AppError(code, HttpStatus.NOT_FOUND, details);
  }
  static conflict(code: ErrorCode, details?: Record<string, unknown>) {
    return new AppError(code, HttpStatus.CONFLICT, details);
  }
  static tooLarge(code: ErrorCode, details?: Record<string, unknown>) {
    return new AppError(code, HttpStatus.PAYLOAD_TOO_LARGE, details);
  }
  static locked(retryAfter: number) {
    return new AppError(ErrorCode.LOCKED, HttpStatus.TOO_MANY_REQUESTS, { retryAfter });
  }
}
