const storageKey = 'ysbk_reservation_intent_v1';

export async function getReservationIntent(payload: object): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  let existing: { key?: string; hash?: string } | null = null;
  try { existing = JSON.parse(sessionStorage.getItem(storageKey) || 'null'); } catch {}
  if (existing?.hash === hash && /^res-req-[a-f0-9-]{36}$/.test(existing.key || '')) return existing.key!;
  const key = `res-req-${crypto.randomUUID()}`;
  try { sessionStorage.setItem(storageKey, JSON.stringify({ key, hash })); } catch {}
  return key;
}

export function clearReservationIntent(): void {
  try { sessionStorage.removeItem(storageKey); } catch {}
}
