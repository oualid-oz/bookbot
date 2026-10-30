import { describe, expect, it } from 'vitest';
import { asinFromUrl, marketplaceForHost, parseBestSellersRank, parsePrice, parseReviewCount } from './parse';

describe('parseBestSellersRank', () => {
  it('reads US product details', () => {
    expect(parseBestSellersRank('Best Sellers Rank: #12,345 in Books (See Top 100 in Books)\n#5 in Children\'s Activity Books'))
      .toEqual({ rank: 12345, category: 'Books' });
  });

  it('reads Kindle ranks', () => {
    expect(parseBestSellersRank('Best Sellers Rank: #1,234 in Kindle Store (See Top 100 in Kindle Store)'))
      .toEqual({ rank: 1234, category: 'Kindle Store' });
  });

  it('reads UK ranks without a #', () => {
    expect(parseBestSellersRank('Best Sellers Rank: 98,765 in Books (See Top 100 in Books)'))
      .toEqual({ rank: 98765, category: 'Books' });
  });

  it('reads German ranks and maps the category', () => {
    expect(parseBestSellersRank('Amazon Bestseller-Rang: Nr. 12.345 in Bücher (Siehe Top 100 in Bücher)'))
      .toEqual({ rank: 12345, category: 'Books' });
  });

  it('keeps unknown categories as written', () => {
    expect(parseBestSellersRank('#42 in Toys & Games (See Top 100)')).toEqual({ rank: 42, category: 'Toys & Games' });
  });

  it('ignores numbers before the rank label', () => {
    const details = 'Edition: 2 in 1 Hardcover Print length: 320 pages Best Sellers Rank: 78 in Books (See Top 100 in Books) 3 in Self Help';
    expect(parseBestSellersRank(details)).toEqual({ rank: 78, category: 'Books' });
  });

  it('reads French ranks', () => {
    expect(parseBestSellersRank("Classement des meilleures ventes d'Amazon : 1 234 en Livres (Voir les 100 premiers en Livres)"))
      .toEqual({ rank: 1234, category: 'Books' });
  });

  it('returns null without a rank', () => {
    expect(parseBestSellersRank('Publisher: Independently published')).toBeNull();
  });
});

describe('parsePrice', () => {
  it.each([
    ['$12.99', 12.99],
    ['£7.49', 7.49],
    ['12,99 €', 12.99],
    ['$1,299.00', 1299],
    ['1.299,00 €', 1299],
    ['￥1,500', 1500],
  ])('%s → %d', (text, value) => {
    expect(parsePrice(text)).toBe(value);
  });

  it('returns null without digits', () => {
    expect(parsePrice('Currently unavailable')).toBeNull();
  });
});

describe('parseReviewCount', () => {
  it('reads separators in any locale', () => {
    expect(parseReviewCount('1,234 ratings')).toBe(1234);
    expect(parseReviewCount('1.234 Sternebewertungen')).toBe(1234);
    expect(parseReviewCount('no ratings')).toBeNull();
  });
});

describe('asinFromUrl and marketplaceForHost', () => {
  it('finds the ASIN', () => {
    expect(asinFromUrl('https://www.amazon.com/Animal-Word-Search/dp/B0ABCDEF12/ref=sr_1_1')).toBe('B0ABCDEF12');
    expect(asinFromUrl('https://www.amazon.de/gp/product/3161484100?th=1')).toBe('3161484100');
    expect(asinFromUrl('https://www.amazon.com/s?k=word+search')).toBeNull();
  });

  it('maps hosts to marketplaces', () => {
    expect(marketplaceForHost('www.amazon.com')).toBe('US');
    expect(marketplaceForHost('www.amazon.co.uk')).toBe('UK');
    expect(marketplaceForHost('www.amazon.co.jp')).toBe('JP');
    expect(marketplaceForHost('amazon.com.evil.example')).toBeNull();
  });
});
