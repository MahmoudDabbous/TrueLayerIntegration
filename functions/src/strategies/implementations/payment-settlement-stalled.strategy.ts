import { logger } from "firebase-functions";
import { WebhookStrategy } from "../webhook-strategy.interface.js";
import { PaymentSettlementStalledPayload } from "../../types/webhook-payloads.js";
import { firestoreService } from "../../services/firestore.service.js";

export class PaymentSettlementStalledStrategy
  implements WebhookStrategy<PaymentSettlementStalledPayload>
{
  getEventType(): string {
    return "payment_settlement_stalled";
  }

  async handle(payload: PaymentSettlementStalledPayload): Promise<void> {
    const eventTimestamp =
      payload.settlement_stalled_at || new Date().toISOString();

    logger.warn(`Payment ${payload.payment_id} settlement stalled`, {
      executedAt: payload.settlement_stalled_at,
      stalledThresholdSeconds: payload.stalled_threshold_seconds,
      paymentId: payload.payment_id,
    });

    await firestoreService.updatePaymentStatus(payload.payment_id, "executed", {
      metadata: {
        lastWebhookEventType: payload.type,
        lastWebhookEventId: payload.event_id,
        lastWebhookEventVersion: payload.event_version,
        settlementStalled: true,
        stalledAt: eventTimestamp,
        stalledThresholdSeconds: payload.stalled_threshold_seconds,
        webhookReceivedAt: new Date().toISOString(),
      },
    });
  }
}
