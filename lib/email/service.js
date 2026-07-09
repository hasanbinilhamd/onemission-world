import nodemailer from 'nodemailer';
import { buildEmailFromAddress, emailConfig, hasSmtpConfiguration } from './config';
import { buildOrderConfirmationEmailHtml, buildOrderConfirmationEmailText } from './templates/order-confirmation';
import { buildPasswordResetEmailHtml, buildPasswordResetEmailText } from './templates/password-reset';

let transporterPromise = null;

async function createTransporter() {
  if (hasSmtpConfiguration()) {
    return nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      auth: emailConfig.user
        ? {
            user: emailConfig.user,
            pass: emailConfig.pass,
          }
        : undefined,
    });
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('SMTP configuration is required in production.');
  }

  const testAccount = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
}

async function getTransporter() {
  if (!transporterPromise) {
    transporterPromise = createTransporter();
  }

  return transporterPromise;
}

export class EmailService {
  async sendMail({ to, subject, html, text }) {
    const transporter = await getTransporter();
    const result = await transporter.sendMail({
      from: buildEmailFromAddress(),
      to,
      subject,
      html,
      text,
    });

    const previewUrl = nodemailer.getTestMessageUrl(result);
    if (previewUrl) {
      console.info('[email-service]', JSON.stringify({
        eventName: 'EMAIL_PREVIEW_URL',
        timestamp: new Date().toISOString(),
        subject,
        to,
        previewUrl,
      }));
    }

    return result;
  }

  async sendPasswordResetEmail({ to, customerName, resetUrl }) {
    return this.sendMail({
      to,
      subject: 'Reset Password',
      html: buildPasswordResetEmailHtml({ customerName, resetUrl }),
      text: buildPasswordResetEmailText({ customerName, resetUrl }),
    });
  }

  async sendOrderConfirmationEmail({ to, order }) {
    return this.sendMail({
      to,
      subject: 'ONEMISSION Order Confirmation',
      html: buildOrderConfirmationEmailHtml({ order }),
      text: buildOrderConfirmationEmailText({ order }),
    });
  }
}

export const emailService = new EmailService();
