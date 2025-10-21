import { logger } from "firebase-functions";
import { WebhookStrategy } from "../webhook-strategy.interface.js";
import { PaymentFundsReceivedPayload } from "../../types/webhook-payloads.js";
import { firestoreService } from "../../services/firestore.service.js";

export class PaymentFundsReceivedStrategy
  implements WebhookStrategy<PaymentFundsReceivedPayload>
{
  getEventType(): string {
    return "payment_funds_received";
  }

  async handle(payload: PaymentFundsReceivedPayload): Promise<void> {
    const eventTimestamp =
      payload.funds_received_at || new Date().toISOString();

    logger.info(
      `Funds received for payment ${payload.payment_id}. Note: Can still be reversed.`,
      {
        timestamp: eventTimestamp,
        paymentId: payload.payment_id,
      }
    );

    await firestoreService.updatePaymentStatus(payload.payment_id, "executed", {
      metadata: {
        lastWebhookEventType: payload.type,
        lastWebhookEventId: payload.event_id,
        lastWebhookEventVersion: payload.event_version,
        fundsReceivedAt: eventTimestamp,
        fundsReceived: true,
        webhookReceivedAt: new Date().toISOString(),
      },
    });
  }
}
