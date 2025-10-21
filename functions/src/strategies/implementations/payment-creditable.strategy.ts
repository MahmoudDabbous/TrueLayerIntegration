import { logger } from "firebase-functions";
import { WebhookStrategy } from "../webhook-strategy.interface.js";
import { PaymentCreditablePayload } from "../../types/webhook-payloads.js";
import { firestoreService } from "../../services/firestore.service.js";

export class PaymentCreditableStrategy
  implements WebhookStrategy<PaymentCreditablePayload>
{
  getEventType(): string {
    return "payment_creditable";
  }

  async handle(payload: PaymentCreditablePayload): Promise<void> {
    const eventTimestamp = payload.creditable_at || new Date().toISOString();

    logger.info(`Payment ${payload.payment_id} is creditable`, {
      timestamp: eventTimestamp,
      paymentId: payload.payment_id,
    });

    await firestoreService.updatePaymentStatus(payload.payment_id, "executed", {
      metadata: {
        lastWebhookEventType: payload.type,
        lastWebhookEventId: payload.event_id,
        lastWebhookEventVersion: payload.event_version,
        creditableAt: eventTimestamp,
        isCredited: true,
        webhookReceivedAt: new Date().toISOString(),
      },
    });
  }
}
