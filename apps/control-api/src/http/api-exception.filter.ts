import type { ApiErrorCode } from "@corri/contracts";
import { Catch, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";

const codeByStatus: Readonly<Partial<Record<number, ApiErrorCode>>> = {
  [HttpStatus.BAD_REQUEST]: "VALIDATION_FAILED",
  [HttpStatus.UNAUTHORIZED]: "UNAUTHENTICATED",
  [HttpStatus.FORBIDDEN]: "FORBIDDEN",
  [HttpStatus.NOT_FOUND]: "NOT_FOUND",
  [HttpStatus.CONFLICT]: "CONFLICT",
  [HttpStatus.GONE]: "EXPIRED",
  [HttpStatus.METHOD_NOT_ALLOWED]: "METHOD_NOT_ALLOWED",
  [HttpStatus.REQUEST_TIMEOUT]: "REQUEST_TIMEOUT",
  [HttpStatus.PAYLOAD_TOO_LARGE]: "PAYLOAD_TOO_LARGE",
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: "UNSUPPORTED_MEDIA_TYPE",
  [HttpStatus.UNPROCESSABLE_ENTITY]: "VALIDATION_FAILED",
  [HttpStatus.TOO_MANY_REQUESTS]: "RATE_LIMITED",
  [HttpStatus.BAD_GATEWAY]: "DEPENDENCY_UNAVAILABLE",
  [HttpStatus.SERVICE_UNAVAILABLE]: "DEPENDENCY_UNAVAILABLE",
  [HttpStatus.GATEWAY_TIMEOUT]: "DEPENDENCY_UNAVAILABLE",
};

const publicMessageByStatus: Readonly<Partial<Record<number, string>>> = {
  [HttpStatus.BAD_REQUEST]: "Request validation failed",
  [HttpStatus.UNAUTHORIZED]: "Authentication required",
  [HttpStatus.FORBIDDEN]: "Access denied",
  [HttpStatus.NOT_FOUND]: "Resource not found",
  [HttpStatus.CONFLICT]: "Request conflicts with current state",
  [HttpStatus.GONE]: "Resource expired",
  [HttpStatus.METHOD_NOT_ALLOWED]: "Method not allowed",
  [HttpStatus.REQUEST_TIMEOUT]: "Request timed out",
  [HttpStatus.PAYLOAD_TOO_LARGE]: "Request payload too large",
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: "Unsupported media type",
  [HttpStatus.UNPROCESSABLE_ENTITY]: "Request validation failed",
  [HttpStatus.TOO_MANY_REQUESTS]: "Rate limit exceeded",
  [HttpStatus.BAD_GATEWAY]: "Service dependency unavailable",
  [HttpStatus.SERVICE_UNAVAILABLE]: "Service dependency unavailable",
  [HttpStatus.GATEWAY_TIMEOUT]: "Service dependency unavailable",
};

function normalizeStatus(status: number): number {
  return Number.isInteger(status) && status >= 400 && status <= 599
    ? status
    : HttpStatus.INTERNAL_SERVER_ERROR;
}

function codeForStatus(status: number): ApiErrorCode {
  return (
    codeByStatus[status] ??
    (status < HttpStatus.INTERNAL_SERVER_ERROR ? "VALIDATION_FAILED" : "INTERNAL_ERROR")
  );
}

function messageForStatus(status: number): string {
  return (
    publicMessageByStatus[status] ??
    (status < HttpStatus.INTERNAL_SERVER_ERROR ? "Request rejected" : "Internal server error")
  );
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<FastifyRequest>();
    const reply = context.getResponse<FastifyReply>();
    const status = normalizeStatus(
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR,
    );
    const code = codeForStatus(status);
    const message = messageForStatus(status);

    if (status >= 500) {
      const exceptionName = exception instanceof Error ? exception.name : "UnknownError";
      this.logger.error({ exceptionName, requestId: request.id }, "Request failed");
    }

    void reply.status(status).send({
      error: {
        code,
        message,
        requestId: request.id,
      },
    });
  }
}
