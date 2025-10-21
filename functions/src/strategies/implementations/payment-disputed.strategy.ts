import { logger } from "firebase-functions";
import { WebhookStrategy } from "../webhook-strategy.interface.js";
import { PaymentDisputedPayload } from "../../types/webhook-payloads.js";
import { firestoreService } from "../../services/firestore.service.js";

export class PaymentDisputedStrategy
  implements WebhookStrategy<PaymentDisputedPayload>
{
  getEventType(): string {
    return "payment_disputed";
  }

  async handle(payload: PaymentDisputedPayload): Promise<void> {
    const eventTimestamp = payload.disputed_at || new Date().toISOString();

    logger.error(`Payment ${payload.payment_id} disputed`, {
      timestamp: eventTimestamp,
      disputeReason: payload.dispute_reason || "unknown",
      paymentId: payload.payment_id,
    });

    await firestoreService.updatePaymentStatus(payload.payment_id, "failed", {
      metadata: {
        lastWebhookEventType: payload.type,
        lastWebhookEventId: payload.event_id,
        lastWebhookEventVersion: payload.event_version,
        disputed: true,
        disputedAt: eventTimestamp,
        disputeReason: payload.dispute_reason,
        webhookReceivedAt: new Date().toISOString(),
      },
    });
  }
}
