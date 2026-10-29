import { defineConfig } from 'wxt';

// Where the Bookbot API lives; set WXT_API_URL when building for production
const apiUrl = process.env.WXT_API_URL ?? 'http://localhost:3000';

export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'Bookbot KDP Spy',
    description: 'Analyze Amazon KDP results for BSR, sales estimates, and competition',
    version: '0.1.0',
    permissions: ['storage'],
    // The API origin lets the background worker call it without CORS
    host_permissions: [`${new URL(apiUrl).origin}/*`],
  },
});
