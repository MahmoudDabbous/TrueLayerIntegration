import { logger } from "firebase-functions";
import { WebhookStrategy } from "./webhook-strategy.interface.js";
import {
  BaseWebhookPayload,
  WebhookEventType,
  WebhookPayload,
} from "../types/webhook-payloads.js";
import { PaymentAuthorizedStrategy } from "./implementations/payment-authorized.strategy.js";
import { PaymentExecutedStrategy } from "./implementations/payment-executed.strategy.js";
import { PaymentFailedStrategy } from "./implementations/payment-failed.strategy.js";
import { PaymentSettledStrategy } from "./implementations/payment-settled.strategy.js";
import { PaymentCreditableStrategy } from "./implementations/payment-creditable.strategy.js";
import { PaymentSettlementStalledStrategy } from "./implementations/payment-settlement-stalled.strategy.js";
import { PaymentDisputedStrategy } from "./implementations/payment-disputed.strategy.js";
import { PaymentReversedStrategy } from "./implementations/payment-reversed.strategy.js";
import { PaymentFundsReceivedStrategy } from "./implementations/payment-funds-received.strategy.js";

export class WebhookStrategyFactory {
  private strategies: Map<WebhookEventType, WebhookStrategy>;

  constructor() {
    this.strategies = new Map();
    this.registerStrategies();
  }

  private registerStrategies(): void {
    const strategyInstances: WebhookStrategy[] = [
      new PaymentAuthorizedStrategy(),
      new PaymentExecutedStrategy(),
      new PaymentFailedStrategy(),
      new PaymentSettledStrategy(),
      new PaymentCreditableStrategy(),
      new PaymentSettlementStalledStrategy(),
      new PaymentDisputedStrategy(),
      new PaymentReversedStrategy(),
      new PaymentFundsReceivedStrategy(),
    ];

    strategyInstances.forEach((strategy) => {
      this.strategies.set(
        strategy.getEventType() as WebhookEventType,
        strategy
      );
    });
  }

  getStrategy(eventType: WebhookEventType): WebhookStrategy | undefined {
    return this.strategies.get(eventType);
  }

  getWebhookStrategy(
    payload: WebhookPayload
  ): WebhookStrategy<BaseWebhookPayload> | undefined {
    const { type: eventType, payment_id: paymentId, event_id } = payload;

    logger.info(
      `Processing webhook event '${eventType}' (ID: ${event_id}) for payment: ${paymentId}`
    );

    if (!paymentId) {
      logger.warn(
        `Webhook event '${eventType}' received without a payment_id.`
      );
      return;
    }

    const strategy = this.getStrategy(eventType);

    if (!strategy) {
      logger.warn(
        `Unknown webhook event type: ${eventType}. Payload: ${JSON.stringify(
          payload
        )}`
      );
      return;
    }

    return strategy;
  }
}

export const webhookStrategyFactory = new WebhookStrategyFactory();
