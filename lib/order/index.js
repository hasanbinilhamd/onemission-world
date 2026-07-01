import { paymentAttemptService } from '@/lib/payment-attempt';
import { normalizeOrderError } from './errors';
import { orderService } from './service';

paymentAttemptService.onPaymentConfirmed = async (paymentAttempt) => {
  return orderService.createFromCheckoutSession({
    paymentAttemptId: paymentAttempt.id,
  });
};

export { orderService, normalizeOrderError };
