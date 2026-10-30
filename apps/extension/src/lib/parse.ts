/**
 * Parsers for Amazon product pages. Pure functions on text, so they can be
 * tested without a browser.
 */

export type Marketplace = 'US' | 'UK' | 'DE' | 'FR' | 'ES' | 'IT' | 'JP';

const HOST_MARKETPLACES: [string, Marketplace][] = [
  ['amazon.co.uk', 'UK'],
  ['amazon.de', 'DE'],
  ['amazon.fr', 'FR'],
  ['amazon.es', 'ES'],
  ['amazon.it', 'IT'],
  ['amazon.co.jp', 'JP'],
  ['amazon.com', 'US'],
];

export function marketplaceForHost(hostname: string): Marketplace | null {
  return HOST_MARKETPLACES.find(([domain]) => hostname === domain || hostname.endsWith(`.${domain}`))?.[1] ?? null;
}

/** Localized top-level category names, mapped to the names our sales models use */
const CATEGORY_ALIASES: Record<string, string> = {
  books: 'Books',
  bücher: 'Books',
  livres: 'Books',
  libros: 'Books',
  libri: 'Books',
  本: 'Books',
  'kindle store': 'Kindle Store',
  'kindle-shop': 'Kindle Store',
  'boutique kindle': 'Kindle Store',
  'tienda kindle': 'Kindle Store',
  'kindleストア': 'Kindle Store',
};

/** "Best Sellers Rank" as each marketplace writes it */
const BSR_LABEL =
  /Best\s*Sellers\s*Rank|Bestseller-Rang|Classement des meilleures ventes d'Amazon|Clasificación en los más vendidos de Amazon|Posizione nella classifica Bestseller di Amazon|売れ筋ランキング/i;

/** Digits only, so "12,345", "12.345", and "12 345" all read as 12345 */
function parseCount(text: string): number | null {
  const digits = text.replace(/\D/g, '');
  return digits ? Number(digits) : null;
}

/**
 * The main Best Sellers Rank from the product details text, e.g.
 * "Best Sellers Rank: #12,345 in Books (See Top 100 in Books)" or
 * "Amazon Bestseller-Rang: Nr. 12.345 in Bücher (Siehe Top 100 in Bücher)"
 */
export function parseBestSellersRank(text: string): { rank: number; category: string } | null {
  // Start at the rank's label when present, so numbers earlier in the product
  // details (e.g. "2 in 1 edition") can't be mistaken for the rank
  const label = text.match(BSR_LABEL);
  if (label?.index !== undefined) text = text.slice(label.index + label[0].length);

  const match = text.match(/(?:#|Nr\.\s*|n\.\s*|nº\s*)?(\d[\d.,\s ]*)\s+(?:in|en|dans|-)\s+([^(\n#]+?)\s*(?:\(|\n|$|#)/i);
  if (!match) return null;
  const rank = parseCount(match[1]);
  if (!rank) return null;
  const name = match[2].trim().replace(/[:.]$/, '');
  return { rank, category: CATEGORY_ALIASES[name.toLowerCase()] ?? name };
}

/** "$12.99", "£7,99", "12,99 €" → 12.99 */
export function parsePrice(text: string): number | null {
  const match = text.replace(/ /g, ' ').match(/(\d[\d.,\s]*)/);
  if (!match) return null;
  let number = match[1].replace(/\s/g, '');
  // The last separator followed by exactly two digits is the decimal point
  const decimal = number.match(/[.,](\d{2})$/);
  number = decimal ? number.slice(0, -3).replace(/[.,]/g, '') + '.' + decimal[1] : number.replace(/[.,]/g, '');
  const value = Number(number);
  return Number.isFinite(value) ? value : null;
}

/** "1,234 ratings", "1.234 Sternebewertungen" → 1234 */
export function parseReviewCount(text: string): number | null {
  return parseCount(text);
}

/** ASIN from a product URL (/dp/…, /gp/product/…) */
export function asinFromUrl(url: string): string | null {
  return url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?]|$)/)?.[1] ?? null;
}
