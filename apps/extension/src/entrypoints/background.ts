import { API_URL, type Request, type Response } from '../lib/messages';

/**
 * All API calls happen here: the extension's own origin is allowed to reach
 * the API (host_permissions), while content scripts would hit Amazon's CORS.
 */
export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: Request, _sender, sendResponse: (r: Response) => void) => {
    handle(message).then(sendResponse);
    return true; // keep the channel open for the async response
  });
});

async function handle(message: Request): Promise<Response> {
  const { apiToken } = await browser.storage.local.get('apiToken');
  if (!apiToken) return { ok: false, error: 'Add your API token in the extension popup' };

  const request =
    message.type === 'estimate'
      ? { path: '/api/ext/estimate', init: { method: 'POST', body: JSON.stringify(message.payload) } }
      : { path: '/api/ext/me', init: { method: 'GET' } };

  try {
    const res = await fetch(`${API_URL}${request.path}`, {
      ...request.init,
      headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error ?? `Request failed (${res.status})` };
    return { ok: true, data };
  } catch {
    return { ok: false, error: `Can't reach Bookbot at ${API_URL}` };
  }
}
