async function getConfig() {
    const response = await fetch('/firebase-config.json');
    return response.json();
}

let createPayment;
async function main() {
    try {
        const firebaseConfig = await getConfig();

        firebase.initializeApp(firebaseConfig);

        const functions = firebase.functions();
        if (location.hostname === "localhost") {
            functions.useEmulator("localhost", 5001);
        }
        createPayment = functions.httpsCallable('createPayment');

        const paymentForm = document.getElementById("paymentForm");

        paymentForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            const submitButton = event.target.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.textContent;

            try {
                // Disable button and show loading state
                submitButton.disabled = true;
                submitButton.textContent = 'Processing...';

                const result = await createPayment({
                    amount: 100.0,
                    provider_id: 'mock-payments-fr-redirect',
                    currency: "EUR",
                });

                const data = result.data;

                if (data.success && data.hppUrl) {
                    // Redirect to payment authorization page
                    window.location.href = data.hppUrl;
                } else if (data.error) {
                    // Handle structured error response
                    handlePaymentError(data.error, data.paymentId);
                    submitButton.disabled = false;
                    submitButton.textContent = originalButtonText;
                } else {
                    alert("Failed to initiate payment. Please try again.");
                    submitButton.disabled = false;
                    submitButton.textContent = originalButtonText;
                }
            } catch (error) {
                console.error("Payment creation error:", error);

                let errorMessage = "An unexpected error occurred. Please try again.";
                let canRetry = true;

                if (error.code && error.message) {
                    errorMessage = error.message;
                    if (error.details && error.details.retryable !== undefined) {
                        canRetry = error.details.retryable;
                    }
                } else if (error.details) {
                    if (error.details.error) {
                        errorMessage = error.details.error.message;
                        canRetry = error.details.error.retryable !== false;
                    }
                } else if (error.message) {
                    errorMessage = error.message;
                }

                alert(errorMessage);

                // Re-enable button if retryable
                if (canRetry) {
                    submitButton.disabled = false;
                    submitButton.textContent = originalButtonText;
                } else {
                    submitButton.textContent = 'Payment Failed';
                }
            }
        });

        function handlePaymentError(error, paymentId) {
            console.error("Payment error:", error, "Payment ID:", paymentId);

            let message = error.message || "Failed to create payment.";

            // Add retry suggestion if applicable
            if (error.retryable) {
                message += " Please try again.";
            } else {
                message += " Please contact support if the issue persists.";
            }

            if (paymentId) {
                message += ` (Payment ID: ${paymentId})`;
            }

            alert(message);
        }
    } catch (error) {
        console.error("Failed to load Firebase config:", error);
        alert('error');
    }
}

main();


