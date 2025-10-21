import { logger } from "firebase-functions";
import { getRetryConfig } from "../config/retry.config.js";

export interface RetryOptions {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: any) => boolean;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  context?: string
): Promise<T> {
  const opts = getRetryConfig();
  let lastError: any;
  let delay = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      const shouldRetry = opts.shouldRetryErrors;

      if (attempt >= opts.maxAttempts || !shouldRetry) {
        logger.error(
          `${context || "Operation"} failed after ${attempt} attempt(s)`,
          {
            error: error.message,
            attempt,
          }
        );
        throw error;
      }

      logger.warn(
        `${context || "Operation"} failed on attempt ${attempt}/${
          opts.maxAttempts
        }. Retrying in ${delay}ms...`,
        {
          error: error.message,
          attempt,
          nextDelay: delay,
        }
      );

      await new Promise((resolve) => setTimeout(resolve, delay));

      delay = Math.min(
        delay * (opts.backoffMultiplier || 2),
        opts.maxDelayMs || 10000
      );
    }
  }

  throw lastError;
}
