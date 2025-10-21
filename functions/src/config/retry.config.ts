import { defineString } from "firebase-functions/params";
// event retry configuration

export const retryMaxAttempts = defineString("RETRY_MAX_ATTEMPTS", {
  default: "5",
});

export const retryInitialDelayMs = defineString("RETRY_INITIAL_DELAY_MS", {
  default: "2000",
});

export const retryBackoffMultiplier = defineString("RETRY_BACKOFF_MULTIPLIER", {
  default: "2",
});

export const retryMaxDelayMs = defineString("RETRY_MAX_DELAY_MS", {
  default: "60000",
});

export const retryShouldRetryErrors = defineString(
  "RETRY_SHOULD_RETRY_ERRORS",
  {
    default: "true",
  }
);

export const requiredRetryConfigSecrets = [];

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  backoffMultiplier: number;
  maxDelayMs: number;
  shouldRetryErrors: boolean;
}

export const getRetryConfig = (): RetryConfig => {
  return {
    maxAttempts: parseInt(retryMaxAttempts.value(), 10),
    initialDelayMs: parseInt(retryInitialDelayMs.value(), 10),
    backoffMultiplier: parseInt(retryBackoffMultiplier.value(), 10),
    maxDelayMs: parseInt(retryMaxDelayMs.value(), 10),
    shouldRetryErrors: retryShouldRetryErrors.value().toLowerCase() === "true",
  };
};
