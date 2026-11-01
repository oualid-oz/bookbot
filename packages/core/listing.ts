/**
 * Checks for a KDP paperback listing (title, description, keywords) against
 * Amazon's metadata guidelines. Errors get a listing rejected or suppressed;
 * warnings are allowed but waste space or hurt discoverability.
 */

export const LISTING_LIMITS = {
  /** Title and subtitle together */
  titleAndSubtitle: 200,
  description: 4000,
  keywordSlots: 7,
  keyword: 50,
  categories: 3,
} as const;

export interface ListingInput {
  title: string;
  subtitle?: string | null;
  author?: string | null;
  description: string;
  keywords: string[];
  categories: string[];
}

export interface ListingIssue {
  field: 'title' | 'subtitle' | 'author' | 'description' | 'keywords' | 'categories';
  level: 'error' | 'warning';
  message: string;
}

/** Sales claims and promotions KDP doesn't allow in metadata */
const PROMOTIONAL = [
  'bestseller', 'best seller', 'best-selling', 'bestselling', '#1', 'number one', 'free', 'sale', 'discount',
  'on sale', 'limited time', 'new release', 'cheap',
];

/** Amazon programs and formats that don't belong in metadata */
const AMAZON_TERMS = ['kindle unlimited', 'kindle', 'amazon', 'kdp', 'audible', 'prime'];

/** Tags KDP accepts in descriptions */
const ALLOWED_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 'br', 'p', 'h4', 'h5', 'h6', 'ul', 'ol', 'li']);

const wordRe = (term: string) => new RegExp(`(^|[^a-z0-9#])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`, 'i');

function findTerms(text: string, terms: string[]) {
  return terms.filter((term) => wordRe(term).test(text));
}

/** Plain text of a description: tags removed */
export function descriptionText(description: string) {
  return description.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ');
}

export function checkListing(listing: ListingInput): ListingIssue[] {
  const issues: ListingIssue[] = [];
  const add = (field: ListingIssue['field'], level: ListingIssue['level'], message: string) => issues.push({ field, level, message });

  const title = listing.title.trim();
  const subtitle = (listing.subtitle ?? '').trim();

  // ---- Title and subtitle ----
  if (!title) add('title', 'error', 'Add a title.');
  if (title.length + subtitle.length > LISTING_LIMITS.titleAndSubtitle) {
    add('subtitle', 'error', `Title and subtitle together must be at most ${LISTING_LIMITS.titleAndSubtitle} characters (now ${title.length + subtitle.length}).`);
  }
  for (const [field, text] of [['title', title], ['subtitle', subtitle]] as const) {
    const promo = findTerms(text, PROMOTIONAL);
    if (promo.length) add(field, 'error', `Remove sales claims like “${promo[0]}”: KDP rejects them.`);
    const amazon = findTerms(text, AMAZON_TERMS);
    if (amazon.length) add(field, 'error', `Remove “${amazon[0]}”: Amazon names and programs aren't allowed.`);
    if (/[<>{}[\]|\\^~]/.test(text)) add(field, 'error', 'Remove symbols like < > { } [ ] | ^ ~ .');
    if (text.length > 15 && text === text.toUpperCase() && /[A-Z]/.test(text)) {
      add(field, 'warning', 'Avoid writing it in all capitals.');
    }
  }
  if (subtitle && subtitle.toLowerCase() === title.toLowerCase()) add('subtitle', 'warning', 'The subtitle repeats the title.');

  // ---- Author ----
  if (!listing.author?.trim()) add('author', 'error', 'Add the author or pen name shown on the cover.');

  // ---- Description ----
  const text = descriptionText(listing.description).trim();
  if (!text) add('description', 'error', 'Add a description.');
  else if (text.length < 150) add('description', 'warning', 'Short descriptions sell poorly: say who the book is for and what is inside.');
  if (listing.description.length > LISTING_LIMITS.description) {
    add('description', 'error', `The description must be at most ${LISTING_LIMITS.description} characters (now ${listing.description.length}).`);
  }
  const badTags = [...listing.description.matchAll(/<\/?\s*([a-z0-9]+)[^>]*>/gi)]
    .map((m) => m[1].toLowerCase())
    .filter((tag) => !ALLOWED_TAGS.has(tag));
  if (badTags.length) add('description', 'error', `KDP doesn't allow the <${badTags[0]}> tag. Use <b>, <i>, <u>, <p>, <br>, headings h4-h6 and lists.`);
  const promo = findTerms(text, ['bestseller', 'best seller', 'on sale', 'limited time', 'discount']);
  if (promo.length) add('description', 'error', `Remove time-limited or sales claims like “${promo[0]}”.`);
  if (/https?:\/\/|www\.|@[a-z0-9-]+\.[a-z]/i.test(text)) add('description', 'error', 'Remove links and email addresses.');

  // ---- Keywords ----
  const keywords = listing.keywords.map((k) => k.trim());
  const filled = keywords.filter(Boolean);
  if (keywords.length > LISTING_LIMITS.keywordSlots) add('keywords', 'error', `KDP has ${LISTING_LIMITS.keywordSlots} keyword boxes.`);
  if (filled.length < LISTING_LIMITS.keywordSlots) {
    add('keywords', 'warning', `Fill all ${LISTING_LIMITS.keywordSlots} keyword boxes (${filled.length} used): each is a free chance to be found.`);
  }
  const titleWords = new Set(`${title} ${subtitle}`.toLowerCase().match(/[a-z0-9]+/g) ?? []);
  const seen = new Set<string>();
  filled.forEach((keyword, i) => {
    const slot = `Keyword ${i + 1}`;
    if (keyword.length > LISTING_LIMITS.keyword) add('keywords', 'error', `${slot} is longer than ${LISTING_LIMITS.keyword} characters.`);
    const lower = keyword.toLowerCase();
    if (seen.has(lower)) add('keywords', 'warning', `${slot} repeats an earlier keyword.`);
    seen.add(lower);
    const banned = [...findTerms(keyword, PROMOTIONAL), ...findTerms(keyword, AMAZON_TERMS)];
    if (banned.length) add('keywords', 'error', `${slot}: remove “${banned[0]}”.`);
    if (/["“”,;]/.test(keyword)) add('keywords', 'warning', `${slot}: quotes, commas and semicolons aren't needed; Amazon matches the words anyway.`);
    const words = lower.match(/[a-z0-9]+/g) ?? [];
    if (words.length && words.every((w) => titleWords.has(w))) {
      add('keywords', 'warning', `${slot} only repeats words from the title, which Amazon already searches.`);
    }
  });

  // ---- Categories ----
  const categories = listing.categories.filter((c) => c.trim());
  if (!categories.length) add('categories', 'warning', 'Pick categories so readers can browse to your book.');
  if (categories.length > LISTING_LIMITS.categories) add('categories', 'error', `KDP allows at most ${LISTING_LIMITS.categories} categories.`);

  return issues;
}
