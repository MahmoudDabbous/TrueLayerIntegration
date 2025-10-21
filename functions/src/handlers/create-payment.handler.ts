import { logger } from "firebase-functions";
import type { CallableRequest } from "firebase-functions/v2/https";
import {
  HttpsError,
  type FunctionsErrorCode,
} from "firebase-functions/v2/https";
import { trueLayerService } from "../services/truelayer.service.js";
import { firestoreService } from "../services/firestore.service.js";
import { getTrueLayerConfig } from "../config/truelayer.config.js";
import { PaymentError, ErrorCode } from "../types/errors.js";

export const createPaymentHandler = async (request: CallableRequest) => {
  let paymentId: string | undefined;

  try {
    logger.info("createPayment called with data:", request.data);

    const { amount, provider_id, currency, metadata } = request.data;

    if (!provider_id) {
      throw new PaymentError({
        code: ErrorCode.VALIDATION_ERROR,
        message: "Missing required field: provider_id",
        httpStatus: 400,
        userMessage: "Please select a payment provider.",
      });
    }

    if (!amount || typeof amount !== "number" || amount <= 0) {
      throw new PaymentError({
        code: ErrorCode.VALIDATION_ERROR,
        message: "Invalid amount. Must be a positive number in the minor unit.",
        httpStatus: 400,
        userMessage: "Please enter a valid payment amount.",
      });
    }

    const config = getTrueLayerConfig();
    const paymentCurrency = currency || config.merchantCurrency;

    if (!config.callbackUrl) {
      throw new PaymentError({
        code: ErrorCode.CONFIGURATION_ERROR,
        message: "TRUELAYER_CALLBACK_URL is not configured.",
        httpStatus: 500,
        userMessage: "Payment system is misconfigured. Please contact support.",
      });
    }

    logger.info(
      `Creating payment of ${amount} ${paymentCurrency} via ${provider_id}`
    );

    const payment = await trueLayerService.createPayment(
      amount,
      paymentCurrency,
      provider_id,
      metadata
    );
    paymentId = payment.id;
    logger.info(`TrueLayer payment created with ID: ${payment.id}`);

    const hppUrl = await trueLayerService.startAuthorizationFlow(
      payment.id,
      config.callbackUrl
    );
    logger.info(`Authorization flow started. HPP URL generated.`);

    try {
      await firestoreService.createPayment(
        payment.id,
        amount,
        paymentCurrency,
        payment.status,
        hppUrl,
        metadata
      );
    } catch (dbError: any) {
      // Don't fail the request if we can't save to Firestore - the payment was already created successfully
      logger.error("Failed to save payment to Firestore:", dbError);
    }

    return {
      success: true,
      paymentId: payment.id,
      hppUrl: hppUrl,
    };
  } catch (error: any) {
    logger.error("Error in createPayment:", {
      error: error?.message || String(error),
      code: error?.code,
      paymentId,
      stack: error?.stack,
    });

    if (error instanceof PaymentError) {
      const code = getHttpsErrorCode(error.code);
      throw new HttpsError(code, error.userMessage, {
        code: error.code,
        paymentId: paymentId,
        retryable: error.retryable,
      });
    }

    throw new HttpsError(
      "internal",
      "An unexpected error occurred. Please try again.",
      {
        code: ErrorCode.UNKNOWN_ERROR,
      }
    );
  }
};

function getHttpsErrorCode(errorCode: ErrorCode): FunctionsErrorCode {
  switch (errorCode) {
    case ErrorCode.VALIDATION_ERROR:
    case ErrorCode.INVALID_PAYMENT_REQUEST:
      return "invalid-argument";
    case ErrorCode.CONFIGURATION_ERROR:
      return "failed-precondition";
    case ErrorCode.FIRESTORE_ERROR:
    case ErrorCode.PAYMENT_CREATION_FAILED:
    case ErrorCode.PAYMENT_EXECUTION_FAILED:
    case ErrorCode.UNKNOWN_ERROR:
      return "internal";
    case ErrorCode.NETWORK_ERROR:
    case ErrorCode.SERVICE_UNAVAILABLE:
      return "unavailable";
    case ErrorCode.AUTH_FAILED:
    case ErrorCode.INVALID_CREDENTIALS:
      return "unauthenticated";
    case ErrorCode.INSUFFICIENT_FUNDS:
    case ErrorCode.PAYMENT_REJECTED:
      return "failed-precondition";
    case ErrorCode.USER_CANCELLED:
      return "cancelled";
    case ErrorCode.AUTHORIZATION_TIMEOUT:
    case ErrorCode.PAYMENT_TIMEOUT:
      return "deadline-exceeded";
    case ErrorCode.RATE_LIMIT_EXCEEDED:
      return "resource-exhausted";
    case ErrorCode.PROVIDER_NOT_AVAILABLE:
      return "not-found";
    default:
      return "internal";
  }
}
