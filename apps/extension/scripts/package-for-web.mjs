// Build the extension and put the zip in the web app, for users to download
// from Settings → Extension. Runs during deployment; if it fails the site
// still deploys, with the download hidden and a warning in the build log.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('../web/public/downloads');
const { version } = JSON.parse(readFileSync('package.json', 'utf-8'));

// Never leave an older build behind if this one fails
rmSync(outDir, { recursive: true, force: true });

// WXT_API_URL wins; on Vercel, default to the site's own production address.
// Elsewhere wxt.config.ts falls back to the repo-root .env.
const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const env = { ...process.env };
if (!env.WXT_API_URL && productionHost) env.WXT_API_URL = `https://${productionHost}`;

try {
  if (process.env.VERCEL && !env.WXT_API_URL) throw new Error('no address: set WXT_API_URL in the Vercel project');

  execFileSync('npx', ['wxt', 'zip'], { env, stdio: 'inherit' });

  const manifest = JSON.parse(readFileSync('.output/chrome-mv3/manifest.json', 'utf-8'));
  const apiUrl = new URL(manifest.host_permissions[0].replace('/*', '')).origin;

  mkdirSync(outDir, { recursive: true });
  copyFileSync(`.output/extension-${version}-chrome.zip`, path.join(outDir, 'bookbot-extension.zip'));
  writeFileSync(path.join(outDir, 'extension.json'), JSON.stringify({ version, apiUrl }) + '\n');
  console.log(`Extension ${version} ready to download (connects to ${apiUrl})`);
} catch (err) {
  rmSync(outDir, { recursive: true, force: true });
  console.warn(`\n⚠ Extension download not built, so it will be hidden in the app: ${err.message}\n`);
}
