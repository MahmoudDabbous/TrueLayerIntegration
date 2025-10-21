import {
  getFirestore,
  Timestamp,
  type Firestore,
  type CollectionReference,
} from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { PaymentStatus } from "../config/truelayer.config.js";
import { PaymentError, ErrorCode } from "../types/errors.js";
import { retryWithBackoff } from "../utils/retry.util.js";

export interface PaymentRecord {
  paymentId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  hppUrl?: string;
  authorizationFlowId?: string;
  userId?: string;
  metadata?: Record<string, any>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export class FirestoreService {
  private db?: Firestore;
  private paymentsCollection?: CollectionReference;

  constructor() {}

  private getDb(): Firestore {
    if (!this.db) {
      this.db = getFirestore();
    }
    return this.db;
  }

  private getPaymentsCollection(): CollectionReference {
    if (!this.paymentsCollection) {
      this.paymentsCollection = this.getDb().collection("payments");
    }
    return this.paymentsCollection;
  }

  private sanitizeData(data: any): any {
    if (data === null || data === undefined) {
      return null;
    }

    if (Array.isArray(data)) {
      return data
        .map((item) => this.sanitizeData(item))
        .filter((item) => item !== undefined);
    }

    if (typeof data === "object" && !(data instanceof Timestamp)) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        const sanitizedValue = this.sanitizeData(value);
        if (sanitizedValue !== undefined) {
          sanitized[key] = sanitizedValue;
        }
      }
      return Object.keys(sanitized).length > 0 ? sanitized : null;
    }

    return data;
  }

  async createPayment(
    paymentId: string,
    amount: number,
    currency: string,
    status: PaymentStatus,
    hppUrl?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const now = Timestamp.now();

    const paymentRecord: any = {
      paymentId,
      amount,
      currency,
      status,
      createdAt: now,
      updatedAt: now,
    };

    if (hppUrl) {
      paymentRecord.hppUrl = hppUrl;
    }

    if (metadata && Object.keys(metadata).length > 0) {
      paymentRecord.metadata = this.sanitizeData(metadata);
    }

    try {
      await retryWithBackoff(async () => {
        await this.getPaymentsCollection().doc(paymentId).set(paymentRecord);
      }, `Create Payment Record (Payment: ${paymentId})`);
      logger.info(`Payment ${paymentId} created in Firestore`);
    } catch (error: any) {
      logger.error("Error creating payment in Firestore:", {
        message: error?.message || String(error),
        paymentId,
        stack: error?.stack,
      });
      throw new PaymentError({
        code: ErrorCode.FIRESTORE_ERROR,
        message: "Failed to save payment record to database",
        httpStatus: 500,
        originalError: error,
        paymentId,
        retryable: true,
        userMessage: "Failed to save payment information. Please try again.",
      });
    }
  }

  async updatePaymentStatus(
    paymentId: string,
    status: PaymentStatus,
    additionalData?: Partial<PaymentRecord>
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
        updatedAt: Timestamp.now(),
      };

      if (additionalData) {
        const sanitized = this.sanitizeData(additionalData);
        if (sanitized) {
          Object.assign(updateData, sanitized);
        }
      }

      await retryWithBackoff(async () => {
        await this.getPaymentsCollection()
          .doc(paymentId)
          .set(updateData, { merge: true });
      }, `Update Payment Status (Payment: ${paymentId}, Status: ${status})`);

      logger.info(`Payment ${paymentId} updated with status: ${status}`);
    } catch (error: any) {
      logger.error(
        "Error updating payment in Firestore:",
        error?.message || error
      );
      throw new PaymentError({
        code: ErrorCode.FIRESTORE_ERROR,
        message: "Failed to update payment record in database",
        httpStatus: 500,
        originalError: error,
        paymentId,
        retryable: true,
        userMessage: "Failed to update payment status. Please try again.",
      });
    }
  }
}

export const firestoreService = new FirestoreService();
