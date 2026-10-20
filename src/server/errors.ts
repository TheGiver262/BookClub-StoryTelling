export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly requestId?: string;

  constructor(message: string, statusCode = 500, errorCode = 'INTERNAL_ERROR', requestId?: string) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.requestId = requestId;
  }

  public toJSON() {
    return {
      error: {
        code: this.errorCode,
        message: this.message,
        requestId: this.requestId,
      },
    };
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, errorCode = 'BAD_REQUEST', requestId?: string) {
    super(message, 400, errorCode, requestId);
    this.name = 'BadRequestError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Yêu cầu xác thực hợp lệ.', errorCode = 'UNAUTHORIZED', requestId?: string) {
    super(message, 401, errorCode, requestId);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Bạn không có quyền thực hiện thao tác này.', errorCode = 'FORBIDDEN', requestId?: string) {
    super(message, 403, errorCode, requestId);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Không tìm thấy tài nguyên yêu cầu.', errorCode = 'NOT_FOUND', requestId?: string) {
    super(message, 404, errorCode, requestId);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Dữ liệu bị xung đột hoặc đã tồn tại.', errorCode = 'CONFLICT', requestId?: string) {
    super(message, 409, errorCode, requestId);
    this.name = 'ConflictError';
  }
}

export class ClosedSessionError extends AppError {
  constructor(message = 'Phiên làm việc đã đóng.', errorCode = 'SESSION_CLOSED', requestId?: string) {
    super(message, 400, errorCode, requestId);
    this.name = 'ClosedSessionError';
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Dịch vụ tạm thời không sẵn sàng.', errorCode = 'SERVICE_UNAVAILABLE', requestId?: string) {
    super(message, 503, errorCode, requestId);
    this.name = 'ServiceUnavailableError';
  }
}

export function formatErrorResponse(err: unknown, requestId?: string): Response {
  if (err instanceof AppError) {
    return new Response(JSON.stringify(err.toJSON()), {
      status: err.statusCode,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': requestId || err.requestId || 'unknown',
        'Cache-Control': 'no-store',
      },
    });
  }

  // Handle Domain Errors (CashSessionError, DepositError, LedgerError) with httpStatus and code
  const anyErr = err as any;
  if (anyErr && typeof anyErr === 'object' && ('httpStatus' in anyErr || 'statusCode' in anyErr) && 'code' in anyErr) {
    const status = anyErr.httpStatus || anyErr.statusCode || 400;
    return new Response(
      JSON.stringify({
        error: {
          code: anyErr.code,
          message: anyErr.message || 'Lỗi xử lý nghiệp vụ.',
          requestId: requestId || 'unknown',
        },
      }),
      {
        status,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId || 'unknown',
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  const body = {
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Lỗi hệ thống nội bộ. Vui lòng thử lại sau.',
      requestId: requestId || 'unknown',
    },
  };

  return new Response(JSON.stringify(body), {
    status: 500,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-Id': requestId || 'unknown',
      'Cache-Control': 'no-store',
    },
  });
}
