import { logger } from "firebase-functions";
import { WebhookStrategy } from "../webhook-strategy.interface.js";
import { PaymentAuthorizedPayload } from "../../types/webhook-payloads.js";
import { firestoreService } from "../../services/firestore.service.js";

export class PaymentAuthorizedStrategy
  implements WebhookStrategy<PaymentAuthorizedPayload>
{
  getEventType(): string {
    return "payment_authorized";
  }

  async handle(payload: PaymentAuthorizedPayload): Promise<void> {
    const eventTimestamp = payload.authorized_at || new Date().toISOString();

    logger.info(`Payment ${payload.payment_id} authorized`, {
      timestamp: eventTimestamp,
      paymentId: payload.payment_id,
    });

    await firestoreService.updatePaymentStatus(
      payload.payment_id,
      "authorized",
      {
        metadata: {
          lastWebhookEventType: payload.type,
          lastWebhookEventId: payload.event_id,
          lastWebhookEventVersion: payload.event_version,
          authorizedAt: eventTimestamp,
          webhookReceivedAt: new Date().toISOString(),
        },
      }
    );
  }
}
