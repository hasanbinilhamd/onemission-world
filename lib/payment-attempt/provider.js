export class PaymentProvider {
  async createPaymentSession() {
    throw new Error('PaymentProvider.createPaymentSession must be implemented by a concrete provider.');
  }

  async getPaymentStatus() {
    throw new Error('PaymentProvider.getPaymentStatus must be implemented by a concrete provider.');
  }

  async cancelPayment() {
    throw new Error('PaymentProvider.cancelPayment must be implemented by a concrete provider.');
  }
}
