import { extractProduct, type ProductInfo } from '../lib/extract';
import type { Estimate, Request, Response } from '../lib/messages';
import { marketplaceForHost, parsePrice, parseReviewCount } from '../lib/parse';

const PANEL_CLASS = 'bookbot-spy-panel';

export default defineContentScript({
  matches: [
    '*://*.amazon.com/*',
    '*://*.amazon.co.uk/*',
    '*://*.amazon.de/*',
    '*://*.amazon.fr/*',
    '*://*.amazon.es/*',
    '*://*.amazon.it/*',
    '*://*.amazon.co.jp/*',
  ],
  main() {
    if (!marketplaceForHost(location.hostname)) return;

    const product = extractProduct(document, location.href);
    if (product) {
      showProductPanel(product);
    } else {
      // Search results load and re-render dynamically
      annotateSearchResults();
      new MutationObserver(annotateSearchResults).observe(document.body, { childList: true, subtree: true });
    }
  },
});

function text(selector: string, root: ParentNode = document): string {
  return root.querySelector(selector)?.textContent?.trim() ?? '';
}

/** Product pages have the BSR, so they get the full estimate */
function showProductPanel(product: ProductInfo) {
  const anchor = document.querySelector('#title, #productTitle')?.closest('div');
  if (!anchor || document.querySelector(`.${PANEL_CLASS}`)) return;

  const { asin, marketplace, title, rank, price, reviews } = product;
  const panel = createPanel();
  addRow(panel, 'BSR', rank ? `#${rank.rank.toLocaleString()} in ${rank.category}` : 'Not found');
  addRow(panel, 'Price', price !== null ? price.toFixed(2) : '—');
  addRow(panel, 'Reviews', reviews !== null ? reviews.toLocaleString() : '—');
  anchor.after(panel);

  if (rank) {
    const result = addRow(panel, 'Sales', 'Estimating…');
    send<Estimate>({
      type: 'estimate',
      payload: { asin, bsr: rank.rank, category: rank.category, marketplace, price: price ?? undefined, reviews: reviews ?? undefined },
    }).then((response) => {
      if (response.ok) {
        result.textContent = `~${response.data.estimatedDailySales.toLocaleString()}/day · ~${response.data.estimatedMonthlySales.toLocaleString()}/month`;
      } else {
        result.textContent = response.error;
        result.style.color = '#b91c1c';
      }
    });
  }

  const save = document.createElement('button');
  save.type = 'button';
  save.textContent = 'Save to Bookbot';
  save.style.cssText =
    'margin-top:6px;padding:4px 10px;border:1px solid #d1d5db;border-radius:6px;background:#fff;color:#111827;font:12px system-ui,sans-serif;cursor:pointer';
  save.addEventListener('click', async () => {
    save.disabled = true;
    save.textContent = 'Saving…';
    const response = await send({
      type: 'saveBook',
      payload: {
        asin,
        marketplace,
        title,
        category: rank?.category,
        bsr: rank?.rank,
        price: price ?? undefined,
        reviews: reviews ?? undefined,
      },
    });
    save.disabled = false;
    save.textContent = response.ok ? 'Saved ✓ (save again later to track changes)' : `Not saved: ${response.error}`;
    save.style.color = response.ok ? '#047857' : '#b91c1c';
  });
  panel.append(save);
}

function send<T>(message: Request): Promise<Response<T>> {
  return browser.runtime.sendMessage(message);
}

/** Search cards don't include the BSR; show what they do have */
function annotateSearchResults() {
  for (const card of document.querySelectorAll<HTMLElement>('[data-component-type="s-search-result"][data-asin]')) {
    if (!card.dataset.asin || card.querySelector(`.${PANEL_CLASS}`)) continue;

    const price = parsePrice(text('.a-price .a-offscreen', card));
    const reviews = parseReviewCount(text('[aria-label$="ratings"], [aria-label*="ratings"] span, .s-underline-text', card));

    const panel = createPanel();
    addRow(panel, 'Price', price !== null ? price.toFixed(2) : '—');
    addRow(panel, 'Reviews', reviews !== null ? reviews.toLocaleString() : '—');
    const hint = document.createElement('div');
    hint.textContent = 'Open the book for its BSR and sales estimate';
    hint.style.cssText = 'margin-top:4px;color:#6b7280';
    panel.append(hint);
    card.append(panel);
  }
}

// Built with textContent only: page data is never interpreted as HTML
function createPanel(): HTMLElement {
  const panel = document.createElement('div');
  panel.className = PANEL_CLASS;
  panel.style.cssText =
    'margin:8px 0;padding:8px 10px;border:1px solid #e5e7eb;border-radius:6px;background:#f9fafb;font:12px/1.5 system-ui,sans-serif;color:#111827';
  const title = document.createElement('div');
  title.textContent = 'Bookbot';
  title.style.cssText = 'font-weight:600;margin-bottom:2px';
  panel.append(title);
  return panel;
}

function addRow(panel: HTMLElement, label: string, value: string): HTMLElement {
  const row = document.createElement('div');
  const name = document.createElement('span');
  name.textContent = `${label}: `;
  name.style.color = '#6b7280';
  const content = document.createElement('span');
  content.textContent = value;
  row.append(name, content);
  panel.append(row);
  return content;
}
