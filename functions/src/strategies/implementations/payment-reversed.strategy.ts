import { logger } from "firebase-functions";
import { WebhookStrategy } from "../webhook-strategy.interface.js";
import { PaymentReversedPayload } from "../../types/webhook-payloads.js";
import { firestoreService } from "../../services/firestore.service.js";

export class PaymentReversedStrategy
  implements WebhookStrategy<PaymentReversedPayload>
{
  getEventType(): string {
    return "payment_reversed";
  }

  async handle(payload: PaymentReversedPayload): Promise<void> {
    const eventTimestamp = payload.reversed_at || new Date().toISOString();

    logger.error(`Payment ${payload.payment_id} reversed`, {
      timestamp: eventTimestamp,
      reversalReason: payload.reversal_reason || "unknown",
      paymentId: payload.payment_id,
    });

    await firestoreService.updatePaymentStatus(payload.payment_id, "failed", {
      metadata: {
        lastWebhookEventType: payload.type,
        lastWebhookEventId: payload.event_id,
        lastWebhookEventVersion: payload.event_version,
        reversed: true,
        reversedAt: eventTimestamp,
        reversalReason: payload.reversal_reason,
        webhookReceivedAt: new Date().toISOString(),
      },
    });
  }
}
