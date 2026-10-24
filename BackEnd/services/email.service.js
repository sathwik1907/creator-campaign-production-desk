/** Transactional account emails through Resend's HTTPS API (no SMTP dependency). */
export function emailDeliveryConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendAccountEmail({ to, subject, text }) {
  if (!emailDeliveryConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Account email delivery is not configured');
    }
    // Local development exposes single-use tokens in API responses instead.
    return false;
  }

  let response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error('Email service is temporarily unavailable');
  }
  if (!response.ok) {
    // Do not leak provider responses or API credentials to clients.
    throw new Error('Email service could not deliver the account message');
  }
  return true;
}

export function accountLink(name, token) {
  const base = process.env.FRONTEND_URL || 'http://localhost:5173';
  const url = new URL(base);
  url.searchParams.set(name, token);
  return url.toString();
}
