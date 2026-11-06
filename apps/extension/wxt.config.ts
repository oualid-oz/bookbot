import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { defineConfig } from 'wxt';

// WXT only reads .env files in this folder; the project keeps one at the repo root
const repoRoot = path.resolve(process.cwd(), '../..');
const rootEnvFile = path.join(repoRoot, '.env');
const rootEnv = existsSync(rootEnvFile) ? parseEnv(readFileSync(rootEnvFile, 'utf-8')) : {};

// Where the Bookbot API lives: WXT_API_URL from the environment or the root .env
const apiUrl = process.env.WXT_API_URL || rootEnv.WXT_API_URL || 'http://localhost:3000';

// The address is fixed at build time, so make it visible, and flag a variable
// left over in the terminal: it wins over the .env file
if (process.env.WXT_API_URL && rootEnv.WXT_API_URL && process.env.WXT_API_URL !== rootEnv.WXT_API_URL) {
  console.warn(
    `\n⚠ WXT_API_URL in this terminal (${process.env.WXT_API_URL}) overrides .env (${rootEnv.WXT_API_URL}). Run "unset WXT_API_URL" to use .env.\n`
  );
}
console.log(`Bookbot API for this build: ${apiUrl}`);

export default defineConfig({
  srcDir: 'src',
  // Icons and other static files
  publicDir: 'src/public',
  // The web app uses 3000
  dev: { server: { port: 3100 } },
  // import.meta.env reads the same file. Only WXT_ and VITE_ variables reach the
  // extension's code, so the other settings in that file stay out of the bundle.
  vite: () => ({ envDir: repoRoot }),
  manifest: {
    name: 'Bookbot KDP Spy',
    description: 'Analyze Amazon KDP results for BSR, sales estimates, and competition',
    permissions: ['storage'],
    // The API origin lets the background worker call it without CORS
    host_permissions: [`${new URL(apiUrl).origin}/*`],
  },
});
