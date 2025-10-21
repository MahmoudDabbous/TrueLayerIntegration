import { defineString, defineSecret } from "firebase-functions/params";

// Secrets for TrueLayer API
const truelayerClientSecret = defineSecret("TRUELAYER_CLIENT_SECRET");
const truelayerPrivateKey = defineSecret("TRUELAYER_PRIVATE_KEY");

const truelayerClientId = defineSecret("TRUELAYER_CLIENT_ID");
const truelayerKid = defineSecret("TRUELAYER_KID");
const truelayerMerchantAccountId = defineSecret(
  "TRUELAYER_MERCHANT_ACCOUNT_ID"
);
const truelayerMerchantCurrency = defineSecret("TRUELAYER_MERCHANT_CURRENCY");
// Non-secret configuration parameters
const truelayerCallbackUrl = defineString("TRUELAYER_CALLBACK_URL");
const truelayerApiUrl = defineString("TRUELAYER_API_URL", {
  default: "https://api.truelayer-sandbox.com",
});
const truelayerAuthUrl = defineString("TRUELAYER_AUTH_URL", {
  default: "https://auth.truelayer-sandbox.com",
});
const truelayerFrontendUrl = defineString("PAYMENT_RESULTS_URL");

export interface TrueLayerConfig {
  clientId: string;
  clientSecret: string;
  privateKey: string;
  keyId: string;
  merchantAccountId: string;
  merchantCurrency: string;
  apiBaseUrl: string;
  authBaseUrl: string;
  callbackUrl: string;
  frontendUrl: string;
}

export const getTrueLayerConfig = (): TrueLayerConfig => {
  return {
    clientId: truelayerClientId.value(),
    clientSecret: truelayerClientSecret.value(),
    privateKey: truelayerPrivateKey.value().replace(/\\n/g, "\n"),
    keyId: truelayerKid.value(),
    merchantAccountId: truelayerMerchantAccountId.value(),
    merchantCurrency: truelayerMerchantCurrency.value(),
    apiBaseUrl: truelayerApiUrl.value(),
    authBaseUrl: truelayerAuthUrl.value(),
    callbackUrl: truelayerCallbackUrl.value(),
    frontendUrl: truelayerFrontendUrl.value(),
  };
};

export const requiredSecrets = [
  truelayerClientSecret,
  truelayerPrivateKey,
  truelayerClientId,
  truelayerKid,
  truelayerMerchantAccountId,
  truelayerMerchantCurrency,
];

export type PaymentStatus =
  | "authorization_required"
  | "authorizing"
  | "authorized"
  | "executed"
  | "settled"
  | "failed";

export const PAYMENT_STATUSES = {
  AUTHORIZATION_REQUIRED: "authorization_required" as PaymentStatus,
  AUTHORIZING: "authorizing" as PaymentStatus,
  AUTHORIZED: "authorized" as PaymentStatus,
  EXECUTED: "executed" as PaymentStatus,
  SETTLED: "settled" as PaymentStatus,
  FAILED: "failed" as PaymentStatus,
} as const;
