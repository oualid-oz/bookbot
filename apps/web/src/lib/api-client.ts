const AUTH_PAGES = ['/login', '/signup', '/forgot-password', '/reset-password', '/verify-email'];

/** Error from one of our API routes, with per-field messages when validation failed */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields: Record<string, string[] | undefined> = {}
  ) {
    super(message);
  }
}

/**
 * fetch() for our JSON API: sends JSON, parses the response, throws ApiError on failure
 */
export async function apiFetch<T>(url: string, init: Omit<RequestInit, 'body'> & { body?: unknown } = {}): Promise<T> {
  const { body, headers, ...rest } = init;
  const response = await fetch(url, {
    ...rest,
    headers: body === undefined ? headers : { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  // Signed out (or the session was revoked): go to login, then come back
  if (response.status === 401 && typeof window !== 'undefined' && !AUTH_PAGES.some((p) => window.location.pathname.startsWith(p))) {
    const back = window.location.pathname + window.location.search;
    window.location.assign(`/login?callbackUrl=${encodeURIComponent(back)}`);
  }

  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(data.error || `Request failed (${response.status})`, response.status, data.fields);
  }
  return data as T;
}
