export const emailConfig = {
  host: String(process.env.SMTP_HOST || '').trim(),
  port: Number.parseInt(String(process.env.SMTP_PORT || '587').trim(), 10) || 587,
  secure: String(process.env.SMTP_SECURE || 'false').trim().toLowerCase() === 'true',
  user: String(process.env.SMTP_USER || '').trim(),
  pass: String(process.env.SMTP_PASS || '').trim(),
  fromName: String(process.env.SMTP_FROM_NAME || 'ONEMISSION').trim(),
  fromEmail: String(process.env.SMTP_FROM_EMAIL || '').trim(),
};

export function hasSmtpConfiguration() {
  return Boolean(emailConfig.host && emailConfig.port && emailConfig.fromEmail);
}

export function buildEmailFromAddress() {
  const fromEmail = emailConfig.fromEmail || 'no-reply@onemission.local';

  return emailConfig.fromName
    ? `${emailConfig.fromName} <${fromEmail}>`
    : fromEmail;
}
