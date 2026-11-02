#!/usr/bin/env node
// Turn dist-single/index.html (from `npm run build:single`) into a page fragment for hosts that supply
// their own <html>/<head>/<body> skeleton. Usage: node scripts/make-artifact.mjs <out.html>
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] ?? join(root, 'dist-single', 'fragment.html');
let html = readFileSync(join(root, 'dist-single', 'index.html'), 'utf8');
html = html
  .replace(/<!doctype html>/i, '')
  .replace(/<html[^>]*>/i, '')
  .replace(/<\/html>/i, '')
  .replace(/<head>/i, '')
  .replace(/<\/head>/i, '')
  .replace(/<body>/i, '')
  .replace(/<\/body>/i, '')
  .replace(/<meta charset="UTF-8"\s*\/?>/i, '')
  .replace(/<meta name="viewport"[^>]*>/i, '');
writeFileSync(out, html.trim() + '\n');
console.log(`Wrote ${out} (${(html.length / 1e6).toFixed(2)} MB)`);
