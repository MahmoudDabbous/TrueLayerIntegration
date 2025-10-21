export type WebhookEventType =
  | "payment_authorized"
  | "payment_executed"
  | "payment_failed"
  | "payment_settled"
  | "payment_creditable"
  | "payment_settlement_stalled"
  | "payment_disputed"
  | "payment_reversed"
  | "payment_funds_received";

export interface BaseWebhookPayload {
  type: WebhookEventType;
  event_id: string;
  event_version: number;
  payment_id: string;
}

/**
 * Payment Authorized Event
 * Sent when a payment is authorized by the PSU
 */
export interface PaymentAuthorizedPayload extends BaseWebhookPayload {
  type: "payment_authorized";
  authorized_at: string;
}

/**
 * Payment Executed Event
 * Sent when a payment is executed
 */
export interface PaymentExecutedPayload extends BaseWebhookPayload {
  type: "payment_executed";
  executed_at: string;
}

/**
 * Payment Failed Event
 * Sent when a payment fails
 */
export interface PaymentFailedPayload extends BaseWebhookPayload {
  type: "payment_failed";
  failed_at: string;
  failure_reason?: string;
  failure_stage?: string;
}

/**
 * Payment Settled Event
 * Sent when a payment settles
 */
export interface PaymentSettledPayload extends BaseWebhookPayload {
  type: "payment_settled";
  settled_at: string;
}

/**
 * Payment Creditable Event
 * Sent when a payment is creditable according to your criteria
 */
export interface PaymentCreditablePayload extends BaseWebhookPayload {
  type: "payment_creditable";
  creditable_at: string;
}

/**
 * Payment Settlement Stalled Event
 * Sent when an executed payment has not settled within your specified duration
 */
export interface PaymentSettlementStalledPayload extends BaseWebhookPayload {
  type: "payment_settlement_stalled";
  settlement_stalled_at: string;
  stalled_threshold_seconds: number;
}

/**
 * Payment Disputed Event
 * Sent when an indemnity claim is made against a payment
 */
export interface PaymentDisputedPayload extends BaseWebhookPayload {
  type: "payment_disputed";
  disputed_at: string;
  dispute_reason?: string;
}

/**
 * Payment Reversed Event
 * Sent when a payment is reversed
 */
export interface PaymentReversedPayload extends BaseWebhookPayload {
  type: "payment_reversed";
  reversed_at: string;
  reversal_reason?: string;
}

/**
 * Payment Funds Received Event
 * Sent when a Direct Debit payment arrived in the merchant account
 * Note: The payment can still be reversed at this stage
 */
export interface PaymentFundsReceivedPayload extends BaseWebhookPayload {
  type: "payment_funds_received";
  funds_received_at: string;
}

export type WebhookPayload =
  | PaymentAuthorizedPayload
  | PaymentExecutedPayload
  | PaymentFailedPayload
  | PaymentSettledPayload
  | PaymentCreditablePayload
  | PaymentSettlementStalledPayload
  | PaymentDisputedPayload
  | PaymentReversedPayload
  | PaymentFundsReceivedPayload;
