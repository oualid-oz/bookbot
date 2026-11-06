const DEFAULT_PAGE = '/home';

/**
 * Where to go after signing in or up: the page from ?callbackUrl= if it is on
 * this site, else the default. Never another site, so a crafted link can't
 * use the login page to send people elsewhere.
 */
export function getCallbackUrl(): string {
  const value = new URLSearchParams(window.location.search).get('callbackUrl');
  if (!value) return DEFAULT_PAGE;
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin ? url.pathname + url.search + url.hash : DEFAULT_PAGE;
  } catch {
    return DEFAULT_PAGE;
  }
}

/** A link to another auth page that keeps the callbackUrl */
export function withCallbackUrl(path: string): string {
  const value = new URLSearchParams(window.location.search).get('callbackUrl');
  return value ? `${path}?callbackUrl=${encodeURIComponent(value)}` : path;
}
