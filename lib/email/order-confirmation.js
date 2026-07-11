import { emailService } from './service';

export class OrderEmailService {
  constructor({ transport = emailService } = {}) {
    this.transport = transport;
  }

  async sendOrderConfirmationEmail({ order }) {
    if (!order?.customerEmail) {
      return { skipped: true, reason: 'CUSTOMER_EMAIL_MISSING' };
    }

    await this.transport.sendOrderConfirmationEmail({
      to: order.customerEmail,
      order,
    });

    return { skipped: false };
  }

  async sendOrderStatusUpdateEmail({ order, statusType }) {
    if (!order?.customerEmail) {
      return { skipped: true, reason: 'CUSTOMER_EMAIL_MISSING' };
    }

    await this.transport.sendOrderStatusUpdateEmail({
      to: order.customerEmail,
      order,
      statusType,
    });

    return { skipped: false };
  }
}

export const orderEmailService = new OrderEmailService();
