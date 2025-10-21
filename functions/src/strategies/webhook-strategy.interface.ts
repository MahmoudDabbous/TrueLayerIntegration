import { BaseWebhookPayload } from "../types/webhook-payloads.js";

/**
 * Strategy interface for handling different webhook event types
 */
export interface WebhookStrategy<T = BaseWebhookPayload> {
  /**
   * Handle the webhook event
   * @param payload The webhook payload
   */
  handle(payload: T): Promise<void>;

  /**
   * Get the event type this strategy handles
   */
  getEventType(): string;
}
