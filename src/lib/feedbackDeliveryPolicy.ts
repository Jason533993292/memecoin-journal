const MAX_DELIVERY_ATTEMPTS = 5;
const MAX_RETRY_DELAY_MINUTES = 60;

export function getFeedbackDeliveryRetry(attempts: number) {
  const normalizedAttempts = Math.max(1, Math.floor(attempts));
  return {
    exhausted: normalizedAttempts >= MAX_DELIVERY_ATTEMPTS,
    delayMinutes: Math.min(MAX_RETRY_DELAY_MINUTES, 2 ** (normalizedAttempts - 1)),
  };
}
