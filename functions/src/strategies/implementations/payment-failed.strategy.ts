import { logger } from "firebase-functions";
import { WebhookStrategy } from "../webhook-strategy.interface.js";
import { PaymentFailedPayload } from "../../types/webhook-payloads.js";
import { firestoreService } from "../../services/firestore.service.js";
import { mapWebhookFailureReason } from "../../types/errors.js";

export class PaymentFailedStrategy
  implements WebhookStrategy<PaymentFailedPayload>
{
  getEventType(): string {
    return "payment_failed";
  }

  async handle(payload: PaymentFailedPayload): Promise<void> {
    const { code, userMessage } = mapWebhookFailureReason(
      payload.failure_reason,
      payload.failure_stage
    );

    const failureTimestamp = payload.failed_at || new Date().toISOString();

    logger.error(`Payment ${payload.payment_id} failed`, {
      timestamp: failureTimestamp,
      failureReason: payload.failure_reason || "unknown",
      failureStage: payload.failure_stage || "unknown",
      errorCode: code,
      paymentId: payload.payment_id,
    });

    await firestoreService.updatePaymentStatus(payload.payment_id, "failed", {
      metadata: {
        lastWebhookEventType: payload.type,
        lastWebhookEventId: payload.event_id,
        lastWebhookEventVersion: payload.event_version,
        failedAt: failureTimestamp,
        failureReason: payload.failure_reason,
        failureStage: payload.failure_stage,
        errorCode: code,
        userMessage: userMessage,
        webhookReceivedAt: new Date().toISOString(),
      },
    });
  }
}
