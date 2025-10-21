/**
 * Custom error types for TrueLayer payment processing
 */

export enum ErrorCode {
  // Authentication errors
  AUTH_FAILED = "AUTH_FAILED",
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",

  // Payment creation errors
  PAYMENT_CREATION_FAILED = "PAYMENT_CREATION_FAILED",
  INVALID_PAYMENT_REQUEST = "INVALID_PAYMENT_REQUEST",
  INSUFFICIENT_FUNDS = "INSUFFICIENT_FUNDS",
  PROVIDER_NOT_AVAILABLE = "PROVIDER_NOT_AVAILABLE",

  // Authorization flow errors
  AUTHORIZATION_FAILED = "AUTHORIZATION_FAILED",
  AUTHORIZATION_TIMEOUT = "AUTHORIZATION_TIMEOUT",
  USER_CANCELLED = "USER_CANCELLED",

  // Payment execution errors
  PAYMENT_EXECUTION_FAILED = "PAYMENT_EXECUTION_FAILED",
  PAYMENT_REJECTED = "PAYMENT_REJECTED",
  PAYMENT_TIMEOUT = "PAYMENT_TIMEOUT",

  // Webhook errors
  WEBHOOK_VERIFICATION_FAILED = "WEBHOOK_VERIFICATION_FAILED",
  WEBHOOK_PROCESSING_FAILED = "WEBHOOK_PROCESSING_FAILED",

  // Database errors
  FIRESTORE_ERROR = "FIRESTORE_ERROR",

  // Network errors
  NETWORK_ERROR = "NETWORK_ERROR",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",

  // Generic errors
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  CONFIGURATION_ERROR = "CONFIGURATION_ERROR",
}

export interface ErrorDetails {
  code: ErrorCode;
  message: string;
  httpStatus?: number;
  originalError?: any;
  paymentId?: string;
  timestamp?: string;
  retryable?: boolean;
  userMessage?: string;
}

export class PaymentError extends Error {
  public readonly code: ErrorCode;
  public readonly httpStatus: number;
  public readonly originalError?: any;
  public readonly paymentId?: string;
  public readonly timestamp: string;
  public readonly retryable: boolean;
  public readonly userMessage: string;

  constructor(details: ErrorDetails) {
    super(details.message);
    this.name = "PaymentError";
    this.code = details.code;
    this.httpStatus = details.httpStatus || 500;
    this.originalError = details.originalError;
    this.paymentId = details.paymentId;
    this.timestamp = details.timestamp || new Date().toISOString();
    this.retryable = details.retryable ?? false;
    this.userMessage =
      details.userMessage || "An error occurred while processing your payment.";

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      httpStatus: this.httpStatus,
      paymentId: this.paymentId,
      timestamp: this.timestamp,
      retryable: this.retryable,
    };
  }
}

/**
 * Parse TrueLayer API error responses into our custom error format
 */
export function parseTrueLayerError(
  error: any,
  paymentId?: string
): PaymentError {
  const response = error.response;
  const data = response?.data;

  // Extract error information from TrueLayer response
  const statusCode = response?.status || 500;
  const truelayerError = data?.errors?.[0];
  const errorType = data?.type || truelayerError?.type;
  const errorMessage =
    truelayerError?.error_description ||
    data?.detail ||
    data?.title ||
    error.message ||
    "Unknown error";

  // Map HTTP status codes and error types to our error codes
  let code: ErrorCode;
  let userMessage: string;
  let retryable = false;

  switch (statusCode) {
    case 400:
      code = ErrorCode.INVALID_PAYMENT_REQUEST;
      userMessage =
        "The payment request is invalid. Please check your details.";
      break;
    case 401:
      code = ErrorCode.AUTH_FAILED;
      userMessage = "Authentication failed. Please try again.";
      retryable = true;
      break;
    case 403:
      code = ErrorCode.INVALID_CREDENTIALS;
      userMessage = "Access denied. Please contact support.";
      break;
    case 404:
      code = ErrorCode.PAYMENT_CREATION_FAILED;
      userMessage = "Payment resource not found.";
      break;
    case 409:
      code = ErrorCode.PAYMENT_CREATION_FAILED;
      userMessage = "A conflict occurred. This payment may already exist.";
      break;
    case 422:
      code = ErrorCode.VALIDATION_ERROR;
      userMessage = "The payment details provided are invalid.";
      break;
    case 429:
      code = ErrorCode.RATE_LIMIT_EXCEEDED;
      userMessage = "Too many requests. Please try again in a moment.";
      retryable = true;
      break;
    case 500:
    case 502:
    case 503:
      code = ErrorCode.SERVICE_UNAVAILABLE;
      userMessage =
        "The payment service is temporarily unavailable. Please try again later.";
      retryable = true;
      break;
    case 504:
      code = ErrorCode.PAYMENT_TIMEOUT;
      userMessage = "The request timed out. Please try again.";
      retryable = true;
      break;
    default:
      code = ErrorCode.UNKNOWN_ERROR;
      userMessage = "An unexpected error occurred. Please try again.";
      retryable = true;
  }

  // Check for specific error types from TrueLayer
  if (errorType?.includes("insufficient_funds")) {
    code = ErrorCode.INSUFFICIENT_FUNDS;
    userMessage = "Insufficient funds available for this payment.";
    retryable = false;
  } else if (errorType?.includes("provider_") || errorType?.includes("bank_")) {
    code = ErrorCode.PROVIDER_NOT_AVAILABLE;
    userMessage = "The selected bank provider is currently unavailable.";
    retryable = true;
  } else if (
    errorType?.includes("cancelled") ||
    errorType?.includes("rejected")
  ) {
    code = ErrorCode.USER_CANCELLED;
    userMessage = "The payment was cancelled.";
    retryable = false;
  }

  return new PaymentError({
    code,
    message: errorMessage,
    httpStatus: statusCode,
    originalError: error,
    paymentId,
    retryable,
    userMessage,
  });
}

/**
 * Map webhook failure reasons to error codes
 */
export function mapWebhookFailureReason(
  failureReason?: string,
  failureStage?: string
): { code: ErrorCode; userMessage: string } {
  const reason = failureReason?.toLowerCase() || "";
  const stage = failureStage?.toLowerCase() || "";

  if (reason.includes("insufficient_funds") || reason.includes("nsf")) {
    return {
      code: ErrorCode.INSUFFICIENT_FUNDS,
      userMessage: "The payment failed due to insufficient funds.",
    };
  }

  if (
    reason.includes("canceled") ||
    reason.includes("cancelled") ||
    reason.includes("rejected")
  ) {
    return {
      code: ErrorCode.USER_CANCELLED,
      userMessage: "The payment was cancelled or rejected.",
    };
  }

  if (reason.includes("timeout") || reason.includes("expired")) {
    return {
      code: ErrorCode.PAYMENT_TIMEOUT,
      userMessage: "The payment request timed out.",
    };
  }

  if (stage.includes("authorization")) {
    return {
      code: ErrorCode.AUTHORIZATION_FAILED,
      userMessage: "Payment authorization failed. Please try again.",
    };
  }

  if (stage.includes("execution")) {
    return {
      code: ErrorCode.PAYMENT_EXECUTION_FAILED,
      userMessage: "Payment execution failed. Please contact support.",
    };
  }

  return {
    code: ErrorCode.PAYMENT_REJECTED,
    userMessage:
      "The payment was rejected. Please try a different payment method.",
  };
}
