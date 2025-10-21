import { logger } from "firebase-functions";
import { WebhookStrategy } from "../webhook-strategy.interface.js";
import { PaymentSettledPayload } from "../../types/webhook-payloads.js";
import { firestoreService } from "../../services/firestore.service.js";

export class PaymentSettledStrategy
  implements WebhookStrategy<PaymentSettledPayload>
{
  getEventType(): string {
    return "payment_settled";
  }

  async handle(payload: PaymentSettledPayload): Promise<void> {
    logger.info(
      `Payment ${payload.payment_id} settled at ${payload.settled_at}`
    );

    await firestoreService.updatePaymentStatus(payload.payment_id, "settled", {
      metadata: {
        lastWebhookEventType: payload.type,
        lastWebhookEventId: payload.event_id,
        lastWebhookEventVersion: payload.event_version,
        settledAt: payload.settled_at,
        webhookReceivedAt: new Date().toISOString(),
      },
    });
  }
}
