export function buildPasswordResetEmailHtml({ customerName, resetUrl }) {
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

export function buildPasswordResetEmailText({ customerName, resetUrl }) {
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
