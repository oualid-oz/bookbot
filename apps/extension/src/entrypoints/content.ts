export default defineContentScript({
  matches: ['*://*.amazon.com/*', '*://*.amazon.co.uk/*', '*://*.amazon.de/*'],
  main() {
    console.log('Bookbot KDP Spy loaded');
    
    // Inject overlay for BSR data
    injectBSROverlay();
  },
});

function injectBSROverlay() {
  // Look for product cards on Amazon search results
  const observer = new MutationObserver(() => {
    const productCards = document.querySelectorAll('[data-component-type="s-search-result"]');
    
    productCards.forEach((card) => {
      if (card.querySelector('.bookbot-spy-overlay')) return;
      
      const asin = card.getAttribute('data-asin');
      if (!asin) return;
      
      // Extract BSR from the page (this is simplified)
      const bsrElement = card.querySelector('[data-csa-c-content-id="best-seller-rank"]');
      const bsr = extractBSR(bsrElement);
      
      // Extract price
      const priceElement = card.querySelector('.a-price .a-offscreen');
      const price = priceElement?.textContent || '';
      
      // Extract reviews
      const reviewsElement = card.querySelector('[aria-label*="reviews"]');
      const reviews = extractReviews(reviewsElement);
      
      // Create overlay
      const overlay = document.createElement('div');
      overlay.className = 'bookbot-spy-overlay';
      overlay.style.cssText = `
        background: #f0f0f0;
        padding: 8px;
        margin-top: 8px;
        border-radius: 4px;
        font-size: 12px;
      `;
      
      overlay.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 4px;">Bookbot Spy</div>
        <div>BSR: ${bsr || 'N/A'}</div>
        <div>Price: ${price}</div>
        <div>Reviews: ${reviews}</div>
        <button id="analyze-${asin}" style="margin-top: 4px; padding: 4px 8px; cursor: pointer;">
          Analyze
        </button>
        <div id="result-${asin}" style="margin-top: 4px; font-size: 11px;"></div>
      `;
      
      card.appendChild(overlay);
      
      // Add click handler
      const button = overlay.querySelector(`#analyze-${asin}`);
      button?.addEventListener('click', () => analyzeProduct(asin, bsr, price, reviews));
    });
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
}

async function analyzeProduct(asin: string, bsr: string, price: string, reviews: string) {
  const resultDiv = document.getElementById(`result-${asin}`);
  if (!resultDiv) return;
  
  resultDiv.textContent = 'Analyzing...';
  
  try {
    // Get API token from storage
    const { apiToken } = await chrome.storage.local.get(['apiToken']);
    if (!apiToken) {
      resultDiv.textContent = 'Error: No API token. Set it in the extension popup.';
      resultDiv.style.color = 'red';
      return;
    }
    
    // Call API
    const response = await fetch('http://localhost:3000/api/ext/estimate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        asin,
        bsr: parseInt(bsr.replace(/,/g, '')) || 0,
        price: parseFloat(price.replace(/[$,]/g, '')) || 0,
        reviews: parseInt(reviews.replace(/,/g, '')) || 0,
        category: 'Books',
        marketplace: getMarketplace(),
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      resultDiv.textContent = `Error: ${data.error}`;
      resultDiv.style.color = 'red';
      return;
    }
    
    resultDiv.innerHTML = `
      <div>Daily Sales: ~${data.estimatedDailySales}</div>
      <div>Monthly Sales: ~${data.estimatedMonthlySales}</div>
    `;
    resultDiv.style.color = 'green';
  } catch (err) {
    resultDiv.textContent = 'Error: Failed to connect to API';
    resultDiv.style.color = 'red';
  }
}

function getMarketplace(): string {
  const hostname = window.location.hostname;
  if (hostname.includes('amazon.co.uk')) return 'UK';
  if (hostname.includes('amazon.de')) return 'DE';
  if (hostname.includes('amazon.fr')) return 'FR';
  if (hostname.includes('amazon.es')) return 'ES';
  if (hostname.includes('amazon.it')) return 'IT';
  if (hostname.includes('amazon.co.jp')) return 'JP';
  return 'US';
}

function extractBSR(element: Element | null): string {
  if (!element) return '';
  const text = element.textContent || '';
  const match = text.match(/#([0-9,]+)/);
  return match ? match[1] : '';
}

function extractReviews(element: Element | null): string {
  if (!element) return '0';
  const text = element.textContent || '';
  const match = text.match(/([0-9,]+)/);
  return match ? match[1] : '0';
}
