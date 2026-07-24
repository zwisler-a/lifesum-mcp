const EXPORT_URL = (date) => `https://api.lifesum.com/food-tracker/v1/export/week/${date}`;

function decodeJwt(token) {
  const payload = token.split('.')[1];
  const json = Buffer.from(payload, 'base64url').toString('utf8');
  return JSON.parse(json);
}

export function tokenStatus(token) {
  const { exp, iat } = decodeJwt(token);
  const now = Math.floor(Date.now() / 1000);
  return {
    issuedAt: new Date(iat * 1000),
    expiresAt: new Date(exp * 1000),
    isExpired: now >= exp,
    secondsRemaining: exp - now,
  };
}

/**
 * Fetches the CSV export for the 7-day window ending on `date` (YYYY-MM-DD).
 * Returns the raw CSV text.
 */
export async function fetchWeekExportCsv(date, token) {
  const status = tokenStatus(token);
  if (status.isExpired) {
    throw new Error(
      `Lifesum token expired at ${status.expiresAt.toISOString()}. Fetch a fresh Bearer token from the browser.`
    );
  }

  const res = await fetch(EXPORT_URL(date), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Lifesum export request failed: ${res.status} ${res.statusText} ${body}`);
  }

  return res.text();
}
