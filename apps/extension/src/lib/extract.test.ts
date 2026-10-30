import { parseHTML } from 'linkedom';
import { describe, expect, it } from 'vitest';
import { extractProduct } from './extract';

// Structure of a real product page, trimmed to the parts we read
const PAGE = `<!doctype html><html><head><title>Atomic Habits : Amazon.co.uk: Books</title></head><body>
  <div id="titleSection"><h1 id="title"><span id="productTitle">  Atomic Habits: the life-changing million-copy #1 bestseller  </span></h1></div>
  <div id="corePrice_feature_div"><span class="a-price"><span class="a-offscreen">£9.56</span></span></div>
  <span id="acrCustomerReviewText">(189,284)</span>
  <div id="detailBulletsWrapper_feature_div"><ul>
    <li>Publisher ‏ : ‎ Random House Business</li><li>Edition ‏ : ‎ 2 in 1</li><li>Print length ‏ : ‎ 320 pages</li>
    <li><span class="a-text-bold">Best Sellers Rank: </span> 78 in Books (<a>See Top 100 in Books</a>)
      <ul><li>3 in Practical &amp; Motivational Self Help</li></ul></li>
  </ul></div>
</body></html>`;

describe('extractProduct', () => {
  it('reads a product page', () => {
    const { document } = parseHTML(PAGE);
    expect(extractProduct(document as unknown as Document, 'https://www.amazon.co.uk/Atomic-Habits/dp/1847941834/ref=sr_1_1')).toEqual({
      asin: '1847941834',
      marketplace: 'UK',
      title: 'Atomic Habits: the life-changing million-copy #1 bestseller',
      rank: { rank: 78, category: 'Books' },
      price: 9.56,
      reviews: 189284,
    });
  });

  it('skips empty price placeholders', () => {
    const page = PAGE.replace(
      '<div id="corePrice_feature_div"><span class="a-price"><span class="a-offscreen">£9.56</span></span></div>',
      '<span class="a-price"><span class="a-offscreen"> </span></span><div id="tmmSwatches"><span class="a-button-selected"><span class="a-color-price">$14.99</span></span></div>'
    );
    const { document } = parseHTML(page);
    expect(extractProduct(document as unknown as Document, 'https://www.amazon.com/dp/1847941834')?.price).toBe(14.99);
  });

  it('ignores pages that are not products', () => {
    const { document } = parseHTML(PAGE);
    expect(extractProduct(document as unknown as Document, 'https://www.amazon.co.uk/s?k=habits')).toBeNull();
    expect(extractProduct(document as unknown as Document, 'https://example.com/dp/1847941834')).toBeNull();
  });

  it('falls back to the page title and tolerates missing details', () => {
    const { document } = parseHTML('<html><head><title>Some Book : Amazon.com: Books</title></head><body></body></html>');
    expect(extractProduct(document as unknown as Document, 'https://www.amazon.com/dp/B0ABCDEF12')).toMatchObject({
      title: 'Some Book',
      rank: null,
      price: null,
      reviews: null,
    });
  });
});
