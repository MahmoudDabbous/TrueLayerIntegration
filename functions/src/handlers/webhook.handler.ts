import * as express from "express";
import { logger } from "firebase-functions";
import type { Request } from "firebase-functions/v2/https";
import { trueLayerService } from "../services/truelayer.service.js";
import { webhookStrategyFactory } from "../strategies/webhook-strategy.factory.js";
import type { WebhookPayload } from "../types/webhook-payloads.js";

export const webhookHandler = async (
  request: Request,
  response: express.Response
): Promise<void> => {
  try {
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      response.status(405).json({ error: "Method not allowed" });
      return;
    }

    const signature = request.headers["tl-signature"] as string;
    if (!signature) {
      logger.warn("Webhook received without Tl-Signature header.");
      response.status(401).json({ error: "Missing signature." });
      return;
    }

    const rawBody = request.rawBody || JSON.stringify(request.body);

    const fullPath = request.url;

    logger.info("Webhook verification details:", {
      requestUrl: request.url,
      fullPath: fullPath,
      bodyType: typeof rawBody,
      bodyLength: rawBody.length,
      hasSignature: !!signature,
    });

    const isValid = await trueLayerService.verifyWebhookSignature(
      signature,
      rawBody.toString("utf-8"),
      fullPath,
      request.headers as Record<string, string>
    );

    if (!isValid) {
      logger.error("Invalid webhook signature.", {
        path: fullPath,
        bodyLength: rawBody.length,
      });
      response.status(401).json({ error: "Invalid signature." });
      return;
    }

    logger.info("Webhook signature verified successfully.");

    const payload: WebhookPayload = request.body;

    logger.info("Processing webhook payload", {
      eventType: payload.type,
      eventId: payload.event_id,
      paymentId: payload.payment_id,
    });

    const strategy = await webhookStrategyFactory.getWebhookStrategy(payload);

    if (strategy) {
      await strategy.handle(payload);
    }

    response.status(200).json({ received: true });
  } catch (error: any) {
    logger.error("Error in webhookHandler:", {
      error: error.message,
      code: error.code,
      stack: error.stack,
    });

    response.status(500).json({
      error: "Failed to process webhook.",
      message: error.message || "An unexpected error occurred.",
    });
  }
};
