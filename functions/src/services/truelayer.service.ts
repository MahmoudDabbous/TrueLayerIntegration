import axios, { AxiosInstance } from "axios";
import { v4 as uuidv4 } from "uuid";
import * as tlSigning from "truelayer-signing";
import { logger } from "firebase-functions";
import {
  getTrueLayerConfig,
  TrueLayerConfig,
  PaymentStatus,
} from "../config/truelayer.config.js";
import {
  PaymentError,
  ErrorCode,
  parseTrueLayerError,
} from "../types/errors.js";
import { retryWithBackoff } from "../utils/retry.util.js";

export interface CreatePaymentRequest {
  amount_in_minor: number;
  currency: string;
  payment_method: {
    type: string;
    provider_selection?: {
      type: string;
      provider_id: string;
      scheme_selection?: {
        type: string;
        scheme_id: string;
      };
    };
    beneficiary: {
      type: string;
      merchant_account_id: string;
    };
  };
  user: {
    name: string;
    email: string;
    phone?: string;
  };
  metadata?: Record<string, any>;
}

export interface PaymentResponse {
  id: string;
  resource_token: string;
  user: {
    id: string;
  };
  status: PaymentStatus;
}

export interface AuthorizationFlowResponse {
  status: string;
  authorization_flow?: {
    actions?: {
      next?: {
        type: string;
        uri?: string;
        [key: string]: any;
      };
    };
  };
}

export interface PaymentStatusResponse {
  id: string;
  status: PaymentStatus;
  amount_in_minor: number;
  currency: string;
  created_at: string;
  payment_method?: any;
}

export class TrueLayerService {
  private _config: TrueLayerConfig | null = null;
  private _apiClient: AxiosInstance | null = null;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  private get config(): TrueLayerConfig {
    if (!this._config) {
      this._config = getTrueLayerConfig();
    }
    return this._config;
  }

  private get apiClient(): AxiosInstance {
    if (!this._apiClient) {
      this._apiClient = axios.create({
        baseURL: this.config.apiBaseUrl,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }
    return this._apiClient;
  }

  constructor() {}

  async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.accessToken && now < this.tokenExpiry) {
      return this.accessToken as string;
    }

    try {
      return await retryWithBackoff(async () => {
        const response = await axios.post(
          `${this.config.authBaseUrl}/connect/token`,
          new URLSearchParams({
            grant_type: "client_credentials",
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            scope: "payments",
          }).toString(),
          {
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            timeout: 10000,
          }
        );
        this.accessToken = response.data.access_token;
        this.tokenExpiry = now + 55 * 60 * 1000;
        return this.accessToken as string;
      }, "Get Access Token");
    } catch (error: any) {
      logger.error(
        "Error getting access token:",
        error.response?.data || error.message
      );

      throw new PaymentError({
        code: ErrorCode.AUTH_FAILED,
        message: "Failed to authenticate with TrueLayer",
        httpStatus: error.response?.status || 500,
        originalError: error,
        retryable: true,
        userMessage: "Authentication failed. Please try again later.",
      });
    }
  }

  private signRequest(
    method: string,
    path: string,
    headers: Record<string, string>,
    body?: any
  ): string {
    try {
      const signature = tlSigning.sign({
        kid: this.config.keyId,
        privateKeyPem: this.config.privateKey,
        method: method.toUpperCase() as tlSigning.HttpMethod,
        path,
        headers,
        body: body ? JSON.stringify(body) : "",
      });
      return signature;
    } catch (error: any) {
      logger.error("Error signing request:", error);
      throw new Error("Failed to sign request");
    }
  }

  async createPayment(
    amountInMinor: number,
    currency: string,
    providerId: string,
    metadata?: Record<string, any>
  ): Promise<PaymentResponse> {
    const accessToken = await this.getAccessToken();
    const idempotencyKey = uuidv4();
    const path = "/v3/payments";

    const schemeId = "sepa_credit_transfer";

    const paymentRequest: CreatePaymentRequest = {
      amount_in_minor: amountInMinor,
      currency: currency,
      payment_method: {
        type: "bank_transfer",
        provider_selection: {
          type: "preselected",
          provider_id: providerId,
          scheme_selection: {
            type: "preselected",
            scheme_id: schemeId,
          },
        },
        beneficiary: {
          type: "merchant_account",
          merchant_account_id: this.config.merchantAccountId,
        },
      },
      user: {
        name: "Demo User",
        email: "demo-user@anapay.com",
        phone: "+448081648350",
      },
      metadata: metadata || {},
    };

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      "Idempotency-Key": idempotencyKey,
    };

    const signature = this.signRequest("POST", path, headers, paymentRequest);
    headers["Tl-Signature"] = signature;

    try {
      return await retryWithBackoff(async () => {
        const response = await this.apiClient.post<PaymentResponse>(
          path,
          paymentRequest,
          {
            headers,
            timeout: 30000,
          }
        );
        return response.data;
      }, `Create Payment (Provider: ${providerId})`);
    } catch (error: any) {
      const errorDetails = error.response?.data;
      logger.error(
        "Error creating payment with TrueLayer:",
        JSON.stringify(errorDetails, null, 2)
      );

      throw parseTrueLayerError(error);
    }
  }

  async startAuthorizationFlow(
    paymentId: string,
    returnUri: string
  ): Promise<string> {
    const accessToken = await this.getAccessToken();
    const path = `/v3/payments/${paymentId}/authorization-flow`;

    const requestBody = {
      redirect: {
        return_uri: returnUri,
      },
    };

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      "Idempotency-Key": uuidv4(),
    };
    const signature = this.signRequest("POST", path, headers, requestBody);
    headers["Tl-Signature"] = signature;

    try {
      logger.info(
        `Starting authorization flow for payment ${paymentId} with return_uri: ${returnUri}`
      );

      return await retryWithBackoff(async () => {
        const response = await this.apiClient.post<AuthorizationFlowResponse>(
          path,
          requestBody,
          {
            headers,
            timeout: 15000,
          }
        );

        logger.info(
          "TrueLayer Authorization Flow Response Body:",
          JSON.stringify(response.data, null, 2)
        );

        const nextAction = response.data.authorization_flow?.actions?.next;
        if (nextAction?.type === "redirect" && nextAction?.uri) {
          return nextAction.uri;
        } else {
          throw new PaymentError({
            code: ErrorCode.AUTHORIZATION_FAILED,
            message: `No HPP redirect URL returned. Next action was '${
              nextAction?.type || "unknown"
            }'.`,
            httpStatus: 500,
            originalError: response.data,
            paymentId,
            retryable: false,
            userMessage:
              "Unable to start payment authorization. Please try again.",
          });
        }
      }, `Start Authorization Flow (Payment: ${paymentId})`);
    } catch (error: any) {
      logger.error(
        "Error starting authorization flow:",
        error.response?.data || error.message
      );

      if (error instanceof PaymentError) {
        throw error;
      }

      throw parseTrueLayerError(error, paymentId);
    }
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatusResponse> {
    const accessToken = await this.getAccessToken();
    const path = `/v3/payments/${paymentId}`;

    try {
      return await retryWithBackoff(async () => {
        const response = await this.apiClient.get<PaymentStatusResponse>(path, {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 10000,
        });
        return response.data;
      }, `Get Payment Status (Payment: ${paymentId})`);
    } catch (error: any) {
      logger.error(
        "Error getting payment status:",
        error.response?.data || error.message
      );

      throw new PaymentError({
        code: ErrorCode.PAYMENT_CREATION_FAILED,
        message: "Failed to get payment status",
        httpStatus: error.response?.status || 500,
        originalError: error,
        paymentId,
        retryable: true,
        userMessage: "Unable to retrieve payment status. Please try again.",
      });
    }
  }

  async verifyWebhookSignature(
    signature: string,
    body: string,
    path: string,
    headers: Record<string, string>
  ): Promise<boolean> {
    try {
      const jku = tlSigning.extractJku(signature);
      if (!jku) {
        logger.error("No JKU found in signature");
        return false;
      }
      const allowedJkus = [
        "https://webhooks.truelayer.com/.well-known/jwks",
        "https://webhooks.truelayer-sandbox.com/.well-known/jwks",
      ];
      if (!allowedJkus.includes(jku)) {
        logger.error("JKU not from allowed TrueLayer domain:", jku);
        return false;
      }
      const jwksResponse = await axios.get(jku);
      const jwks = JSON.stringify(jwksResponse.data);
      tlSigning.verify({
        jwks,
        signature,
        method: tlSigning.HttpMethod.Post,
        path,
        headers,
        body,
      });
      return true;
    } catch (error: any) {
      logger.error("Webhook signature verification failed:", error);
      return false;
    }
  }
}

export const trueLayerService = new TrueLayerService();
