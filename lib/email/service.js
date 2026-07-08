import nodemailer from 'nodemailer';
import { buildEmailFromAddress, emailConfig, hasSmtpConfiguration } from './config';

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

function buildPasswordResetEmailHtml({ customerName, resetUrl }) {
  return `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6; max-width: 560px; margin: 0 auto;">
      <p>Hello ${customerName},</p>
      <p>We received a request to reset your password.</p>
      <p>
        <a
          href="${resetUrl}"
          style="display: inline-block; padding: 12px 20px; background: #111827; color: #ffffff; text-decoration: none; border-radius: 999px; font-weight: 600;"
        >
          Reset Password
        </a>
      </p>
      <p>If the button above does not work, open this link:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>If you did not request this, you can safely ignore this email.</p>
    </div>
  `;
}

function buildPasswordResetEmailText({ customerName, resetUrl }) {
  return [
    `Hello ${customerName},`,
    '',
    'We received a request to reset your password.',
    '',
    `Reset Password: ${resetUrl}`,
    '',
    'If you did not request this, you can safely ignore this email.',
  ].join('\n');
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
}

export const emailService = new EmailService();
