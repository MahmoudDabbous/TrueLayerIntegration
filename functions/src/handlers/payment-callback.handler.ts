import { logger } from "firebase-functions";
import type { Request } from "firebase-functions/v2/https";
import { trueLayerService } from "../services/truelayer.service.js";
import { firestoreService } from "../services/firestore.service.js";
import * as express from "express";
import { PaymentError } from "../types/errors.js";

export const paymentCallbackHandler = async (
  request: Request,
  response: express.Response
): Promise<void> => {
  const frontendUrl = process.env.PAYMENT_RESULTS_URL;
  let paymentId: string | undefined;

  try {
    if (request.method !== "GET") {
      response.setHeader("Allow", "GET");
      response.status(405).json({ error: "Method not allowed" });
      return;
    }

    paymentId = request.query.payment_id as string;

    if (!paymentId) {
      response.status(400).json({ error: "Missing 'payment_id' parameter." });
      return;
    }

    logger.info(`Payment callback received for payment ID: ${paymentId}`);

    const paymentDetails = await trueLayerService.getPaymentStatus(paymentId);
    const { status, amount_in_minor, currency } = paymentDetails;
    logger.info(`Payment ${paymentId} has status: ${status}`);

    try {
      await firestoreService.updatePaymentStatus(paymentId, status, {
        metadata: {
          callbackReceivedAt: new Date().toISOString(),
        },
      });
    } catch (dbError: any) {
      // Non-critical - just log and continue with the redirect
      logger.error(
        `Failed to update Firestore for payment ${paymentId}:`,
        dbError
      );
    }

    const resultUrl = new URL(`${frontendUrl}`);
    resultUrl.searchParams.append("payment_id", paymentId);
    resultUrl.searchParams.append("status", status);
    resultUrl.searchParams.append("amount", String(amount_in_minor));
    resultUrl.searchParams.append("currency", currency);

    response.redirect(resultUrl.toString());
  } catch (error: any) {
    logger.error("Error in paymentCallbackHandler:", {
      error: error.message,
      code: error.code,
      paymentId,
    });

    const errorUrl = new URL(`${frontendUrl}/payment-result.html`);

    if (error instanceof PaymentError) {
      errorUrl.searchParams.append("error", error.userMessage);
      errorUrl.searchParams.append("error_code", error.code);
    } else {
      errorUrl.searchParams.append(
        "error",
        "An error occurred while processing your payment callback."
      );
    }

    if (paymentId) {
      errorUrl.searchParams.append("payment_id", paymentId);
    }

    response.redirect(errorUrl.toString());
  }
};
