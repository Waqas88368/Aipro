// Builds the upload-ready theme zip at ../dist/<name>.zip (theme folder only,
// no dev harness). Runs theme-check first and aborts on errors.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { check, Severity } from '@shopify/theme-check-node';

const here = path.dirname(fileURLToPath(import.meta.url));
const themeRoot = path.resolve(here, '..', 'theme');
const dist = path.resolve(here, '..', 'dist');
const name = process.argv[2] || 'linux-liquid-glass-theme';

const offenses = await check(themeRoot);
const errors = offenses.filter((o) => o.severity === Severity.ERROR);
if (errors.length) {
  console.error(`theme-check: ${errors.length} error(s) — fix them before packaging (node check.mjs)`);
  process.exit(1);
}

fs.mkdirSync(dist, { recursive: true });
const out = path.join(dist, `${name}.zip`);
fs.rmSync(out, { force: true });
// Shopify expects the theme folders at the zip root (or one wrapping folder).
execFileSync('zip', ['-qr', '-X', out, 'assets', 'config', 'layout', 'locales', 'sections', 'snippets', 'templates', '-x', '*.DS_Store'], { cwd: themeRoot, stdio: 'inherit' });

const size = fs.statSync(out).size;
const count = execFileSync('unzip', ['-Z1', out]).toString().trim().split('\n').length;
console.log(`${path.relative(process.cwd(), out)} — ${count} files, ${(size / 1024 / 1024).toFixed(1)} MB`);
if (size > 50 * 1024 * 1024) { console.error('Shopify rejects theme zips over 50 MB'); process.exit(1); }
