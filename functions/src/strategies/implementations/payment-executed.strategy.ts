import { logger } from "firebase-functions";
import { WebhookStrategy } from "../webhook-strategy.interface.js";
import { PaymentExecutedPayload } from "../../types/webhook-payloads.js";
import { firestoreService } from "../../services/firestore.service.js";

export class PaymentExecutedStrategy
  implements WebhookStrategy<PaymentExecutedPayload>
{
  getEventType(): string {
    return "payment_executed";
  }

  async handle(payload: PaymentExecutedPayload): Promise<void> {
    const eventTimestamp = payload.executed_at || new Date().toISOString();

    logger.info(`Payment ${payload.payment_id} executed`, {
      timestamp: eventTimestamp,
      paymentId: payload.payment_id,
    });

    await firestoreService.updatePaymentStatus(payload.payment_id, "executed", {
      metadata: {
        lastWebhookEventType: payload.type,
        lastWebhookEventId: payload.event_id,
        lastWebhookEventVersion: payload.event_version,
        executedAt: eventTimestamp,
        webhookReceivedAt: new Date().toISOString(),
      },
    });
  }
}
