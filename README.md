# TrueLayer Payment Integration

A Firebase-based payment processing system integrated with TrueLayer's payment API. This project provides a complete payment flow with webhook handling for real-time payment status updates.

## Features

- 💳 Create and process payments via TrueLayer
- 🔔 Real-time webhook notifications for payment events
- 🔄 Automatic retry logic for failed operations
- 📊 Firestore database for payment tracking
- 🎨 Simple web interface for payment initiation
- 🔐 Secure webhook signature verification

## Project Structure

```
TrueLayerIntegration/
├── client/              # Frontend files (hosted via Firebase Hosting)
├── functions/          # Firebase Cloud Functions
│   ├── src/           # TypeScript source files
│   └── lib/           # Compiled JavaScript (generated)
├── firebase.json      # Firebase configuration
└── firestore.rules    # Firestore security rules
```

## Prerequisites

- [Node.js](https://nodejs.org/) v22 or higher
- [Firebase CLI](https://firebase.google.com/docs/cli) installed globally
- A [Firebase project](https://console.firebase.google.com/)
- A [TrueLayer account](https://console.truelayer.com/) with API credentials

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
cd TrueLayerIntegration
cd functions
npm install
```

### 2. Configure Firebase

Login to Firebase:

```bash
firebase login
```

Set your Firebase project:

```bash
firebase use <your-project-id>
```

### 3. Set Environment Variables

#### 1. for Development

In the `functions` directory
- Copy `.env.example` to `.env.local` for your normal environment variable
- and to `.secrets.local` file for your secrets 

#### 2. for Production

- Copy `.env.local` to `.env` and fill in your production values
- and Set secrets directly in the Firebase console using Firebase CLI:

```bash
firebase functions:secrets:set TRUELAYER_CLIENT_ID 
firebase functions:secrets:set TRUELAYER_CLIENT_SECRET
...etc
```

### 4. Configure Firebase Client

Update `client/firebase-config.json` with your Firebase project configuration:

```json
{
  "apiKey": "your-api-key",
  "authDomain": "your-project.firebaseapp.com",
  "projectId": "your-project-id",
  "storageBucket": "your-project.appspot.com",
  "messagingSenderId": "123456789",
  "appId": "your-app-id"
}
```

### 5. Deploy to Firebase

Deploy everything:

```bash
firebase deploy
```

Or deploy specific components:

```bash
firebase deploy --only functions
firebase deploy --only hosting
firebase deploy --only firestore
```

## Local Development

### Run Firebase Emulators

Start the local emulator suite:

```bash
cd functions
npm run serve
```

This starts:

- Functions: `http://localhost:5001`
- Hosting: `http://localhost:5000`
- Firestore: `http://localhost:8080`
- Emulator UI: `http://localhost:4000`

### Build TypeScript

Watch mode (auto-compile on save):

```bash
cd functions
npm run build:watch
```

Single build:

```bash
cd functions
npm run build
```

## API Endpoints

### Cloud Functions

- **`createPayment`** - Callable function to initiate a payment
- **`paymentCallback`** - GET endpoint for TrueLayer redirect after payment
- **`webhook`** - POST endpoint for TrueLayer webhook events

## Payment Flow

1. User initiates payment from the web interface
2. `createPayment` function creates a payment with TrueLayer
3. User is redirected to TrueLayer's payment page
4. After completion, user is redirected back via `paymentCallback`
5. TrueLayer sends webhook notifications to `webhook` endpoint
6. Payment status is updated in Firestore

## Webhook Events Supported

The system handles the following TrueLayer webhook events:

- `payment_authorized` - Payment has been authorized
- `payment_executed` - Payment has been executed
- `payment_settled` - Payment has been settled
- `payment_failed` - Payment has failed
- `payment_creditable` - Payment is creditable
- `payment_funds_received` - Funds have been received
- `payment_reversed` - Payment has been reversed
- `payment_disputed` - Payment has been disputed
- `payment_settlement_stalled` - Settlement has stalled

## Firestore Collections

- **`payments`** - Stores payment records with status updates

## Environment Variables Reference

| Variable | Description |
|----------|-------------|
|TRUELAYER_CALLBACK_URL | The callback URL for TrueLayer to redirect after payment|
|TRUELAYER_API_URL | The API URL for TrueLayer|
|TRUELAYER_AUTH_URL | The authorization URL for TrueLayer|
|PAYMENT_RESULTS_URL | The URL for payment results|
|RETRY_MAX_ATTEMPTS | The maximum number of retry attempts|
|RETRY_INITIAL_DELAY_MS | The initial delay before retrying (in milliseconds)|
|RETRY_BACKOFF_MULTIPLIER | The backoff multiplier for retries|
|RETRY_MAX_DELAY_MS | The maximum delay for retries|
|RETRY_SHOULD_RETRY_ERRORS | The error types that should trigger a retry|
|TRUELAYER_CLIENT_SECRET | The client secret for TrueLayer|
|TRUELAYER_PRIVATE_KEY | The private key for TrueLayer|
|TRUELAYER_CLIENT_ID | The client ID for TrueLayer|
|TRUELAYER_KID | The key ID for TrueLayer|
|TRUELAYER_MERCHANT_ACCOUNT_ID | The merchant account ID for TrueLayer|
|TRUELAYER_MERCHANT_CURRENCY | The merchant currency for TrueLayer|

## Security

- Firestore security rules are defined in `firestore.rules`
- All sensitive credentials are stored as Firebase Secrets
- Webhook signatures are verified to ensure authenticity
- CORS is enabled for the frontend
