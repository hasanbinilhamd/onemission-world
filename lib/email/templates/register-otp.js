export function buildRegisterOtpEmailHtml({ customerName, otp }) {
  return `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6; max-width: 560px; margin: 0 auto;">
      <p>Hello ${customerName},</p>
      <p>Welcome to ONEMISSION. Use the verification code below to complete your account registration.</p>
      <div style="margin: 24px 0; padding: 20px; border: 1px solid #E5E7EB; border-radius: 20px; text-align: center; background: #F9FAFB;">
        <p style="margin: 0 0 8px; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #6B7280; font-weight: 600;">Verification Code</p>
        <p style="margin: 0; font-size: 32px; letter-spacing: 0.24em; font-weight: 700; color: #111827;">${otp}</p>
      </div>
      <p>This code expires in 10 minutes.</p>
      <p>If you did not request this code, please ignore this email.</p>
    </div>
  `;
}

export function buildRegisterOtpEmailText({ customerName, otp }) {
  return [
    `Hello ${customerName},`,
    '',
    'Welcome to ONEMISSION. Use the verification code below to complete your account registration.',
    '',
    `Verification Code: ${otp}`,
    '',
    'This code expires in 10 minutes.',
    'If you did not request this code, please ignore this email.',
  ].join('\n');
}
