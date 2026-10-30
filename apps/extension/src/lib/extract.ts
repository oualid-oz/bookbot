import { asinFromUrl, marketplaceForHost, parseBestSellersRank, parsePrice, parseReviewCount, type Marketplace } from './parse';

export interface ProductInfo {
  asin: string;
  marketplace: Marketplace;
  title: string;
  rank: { rank: number; category: string } | null;
  price: number | null;
  reviews: number | null;
}

const text = (root: ParentNode, selector: string) => root.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

/** Where book pages show the buying price, most specific first */
const PRICE_SELECTORS = [
  '#corePrice_feature_div .a-offscreen',
  '#corePriceDisplay_desktop_feature_div .a-offscreen',
  '#price',
  '#newBuyBoxPrice',
  '#kindle-price',
  '#tmm-grid-swatch-paperback .slot-price',
  '#tmmSwatches .a-button-selected .a-color-price',
  '.a-price .a-offscreen',
];

/**
 * The first element that actually holds a price. Some pages have empty
 * price placeholders, so every match is checked, not just the first.
 */
function findPrice(root: ParentNode): number | null {
  for (const selector of PRICE_SELECTORS) {
    for (const el of root.querySelectorAll(selector)) {
      const price = parsePrice(el.textContent ?? '');
      if (price) return price;
    }
  }
  return null;
}

/**
 * Read a product page. Returns null when the page isn't an Amazon product.
 */
export function extractProduct(document: Document, url: string): ProductInfo | null {
  const { hostname } = new URL(url);
  const marketplace = marketplaceForHost(hostname);
  const asin = asinFromUrl(url);
  if (!marketplace || !asin) return null;

  const details =
    text(document, '#detailBulletsWrapper_feature_div') ||
    text(document, '#productDetails_detailBullets_sections1') ||
    text(document, '#prodDetails') ||
    text(document, '#SalesRank');

  return {
    asin,
    marketplace,
    title: text(document, '#productTitle') || document.title.replace(/\s*[:|-]\s*Amazon\..*$/i, '').trim(),
    rank: parseBestSellersRank(details),
    price: findPrice(document),
    reviews: parseReviewCount(text(document, '#acrCustomerReviewText')),
  };
}
