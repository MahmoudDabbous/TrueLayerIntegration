import {
  HttpsOptions,
  onRequest,
  onCall,
  HttpsError,
} from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import { logger } from "firebase-functions";
import { initializeApp } from "firebase-admin/app";
import { paymentCallbackHandler } from "./handlers/payment-callback.handler.js";
import { webhookHandler } from "./handlers/webhook.handler.js";
import { requiredSecrets } from "./config/truelayer.config.js";
import { createPaymentHandler } from "./handlers/create-payment.handler.js";

setGlobalOptions({
  maxInstances: 10,
  memory: "256MiB",
  timeoutSeconds: 60,
  region: "us-central1",
});

initializeApp();

const functionOptions: HttpsOptions = {
  cors: true,
  secrets: requiredSecrets,
};

export const createPayment = onCall(functionOptions, async (data) => {
  try {
    return createPaymentHandler(data);
  } catch (error) {
    logger.error("Error in createPayment", error);
    throw new HttpsError("internal", "Payment creation failed");
  }
});

export const paymentCallback = onRequest(functionOptions, async (req, res) => {
  logger.info(`${req.method} /paymentCallback - ${new Date().toISOString()}`);
  try {
    await paymentCallbackHandler(req, res as any);
  } catch (error) {
    logger.error("Error in paymentCallback", error);
    if (!res.headersSent) {
      res.status(500).send("Payment callback processing failed");
    }
  }
});

export const webhook = onRequest(functionOptions, async (req, res) => {
  logger.info(`${req.method} /webhook - ${new Date().toISOString()}`);
  try {
    await webhookHandler(req, res as any);
  } catch (error) {
    logger.error("Error in webhook", error);
    if (!res.headersSent) {
      res.status(500).send("Webhook processing failed");
    }
  }
});
