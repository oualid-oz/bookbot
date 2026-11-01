// Renders the toolbar and store icons from one SVG: node scripts/make-icons.mjs
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

// sharp is installed for the web app
const sharp = createRequire(path.resolve('../web/package.json'))('sharp');

// An open book on the brand-colored rounded square
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="28" fill="#18181b"/>
  <path d="M64 40c-10-7-24-9-36-7v52c12-2 26 0 36 7 10-7 24-9 36-7V33c-12-2-26 0-36 7z" fill="none" stroke="#fafafa" stroke-width="7" stroke-linejoin="round"/>
  <path d="M64 40v52" stroke="#fafafa" stroke-width="7" stroke-linecap="round"/>
</svg>`;

await mkdir('src/public/icon', { recursive: true });
for (const size of [16, 32, 48, 128]) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(`src/public/icon/${size}.png`);
}
console.log('Wrote src/public/icon/{16,32,48,128}.png');
