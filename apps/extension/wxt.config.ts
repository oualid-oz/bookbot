import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'Bookbot KDP Spy',
    description: 'Analyze Amazon KDP results for BSR, sales estimates, and competition',
    version: '0.1.0',
    permissions: ['storage', 'activeTab'],
    host_permissions: ['*://*.amazon.com/*', '*://*.amazon.co.uk/*', '*://*.amazon.de/*'],
  },
});
