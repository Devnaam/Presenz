import crypto from 'crypto';

/**
 * Verify Razorpay webhook signature
 */
export const verifyRazorpaySignature = (
  body: string,
  signature: string,
  secret: string
): boolean => {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  return expectedSignature === signature;
};

/**
 * Calculate trial end date (7 days from now)
 */
export const getTrialEndDate = (): Date => {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date;
};

/**
 * Calculate subscription period end date (30 days from start)
 */
export const getSubscriptionEndDate = (startDate: Date): Date => {
  const date = new Date(startDate);
  date.setDate(date.getDate() + 30);
  return date;
};

/**
 * Check if subscription is expired
 */
export const isSubscriptionExpired = (endDate: Date): boolean => {
  return new Date() > new Date(endDate);
};