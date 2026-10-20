export function availabilityRefreshInterval(now = new Date()): number {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short' }).format(now);
  return weekday === 'Tue' || weekday === 'Thu' ? 30000 : 60000;
}

export function startAvailabilityRefresh(
  refresh: () => Promise<void> | void,
  doc: Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'> = document,
  win: Pick<Window, 'setInterval' | 'clearInterval' | 'addEventListener' | 'removeEventListener'> = window,
): () => void {
  let busy = false;
  let disposed = false;
  const run = async () => {
    if (disposed || doc.hidden || busy) return;
    busy = true;
    try { await refresh(); }
    catch { /* The caller displays its own load error. */ }
    finally { busy = false; }
  };
  const timer = win.setInterval(run, availabilityRefreshInterval());
  doc.addEventListener('visibilitychange', run);
  win.addEventListener('focus', run);
  win.addEventListener('ysbk:availability-changed', run);
  return () => {
    disposed = true;
    win.clearInterval(timer);
    doc.removeEventListener('visibilitychange', run);
    win.removeEventListener('focus', run);
    win.removeEventListener('ysbk:availability-changed', run);
  };
}
