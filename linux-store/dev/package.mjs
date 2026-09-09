// Builds the deliverables in ../dist:
//   linux-liquid-glass-theme.zip   ← upload this in Shopify (theme folders at zip root)
//   LINUX-theme-delivery.zip       ← everything: the theme zip + install guide (AR/EN)
//                                    + hero video masters + brand assets used
// Runs theme-check first and aborts on errors.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { check, Severity } from '@shopify/theme-check-node';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const themeRoot = path.join(root, 'theme');
const dist = path.join(root, 'dist');
const name = process.argv[2] || 'linux-liquid-glass-theme';

const offenses = await check(themeRoot);
const errors = offenses.filter((o) => o.severity === Severity.ERROR);
if (errors.length) {
  console.error(`theme-check: ${errors.length} error(s) — fix them before packaging (node check.mjs)`);
  process.exit(1);
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

// 1) Shopify theme zip
const themeZip = path.join(dist, `${name}.zip`);
execFileSync('zip', ['-qr', '-X', themeZip, 'assets', 'config', 'layout', 'locales', 'sections', 'snippets', 'templates', '-x', '*.DS_Store'], { cwd: themeRoot, stdio: 'inherit' });
const size = fs.statSync(themeZip).size;
const count = execFileSync('unzip', ['-Z1', themeZip]).toString().trim().split('\n').length;
console.log(`${path.relative(process.cwd(), themeZip)} — ${count} files, ${(size / 1024 / 1024).toFixed(1)} MB`);
if (size > 50 * 1024 * 1024) { console.error('Shopify rejects theme zips over 50 MB'); process.exit(1); }

// 2) Delivery bundle
const stage = path.join(dist, 'LINUX-theme-delivery');
fs.mkdirSync(path.join(stage, 'hero-video'), { recursive: true });
fs.mkdirSync(path.join(stage, 'brand-assets'), { recursive: true });
fs.copyFileSync(themeZip, path.join(stage, `${name}.zip`));
fs.copyFileSync(path.join(root, 'INSTALL.md'), path.join(stage, 'INSTALL.md'));
for (const f of ['hero-embroidery-1080.mp4', 'hero-embroidery-720.mp4', 'hero-embroidery-poster.webp']) fs.copyFileSync(path.join(themeRoot, 'assets', f), path.join(stage, 'hero-video', f));
for (const f of fs.readdirSync(path.join(themeRoot, 'assets')).filter((f) => /^(mascot-|brand-|favicon-|wordmark)/.test(f))) fs.copyFileSync(path.join(themeRoot, 'assets', f), path.join(stage, 'brand-assets', f));
const bundle = path.join(dist, 'LINUX-theme-delivery.zip');
execFileSync('zip', ['-qr', '-X', bundle, 'LINUX-theme-delivery'], { cwd: dist, stdio: 'inherit' });
fs.rmSync(stage, { recursive: true, force: true });
console.log(`${path.relative(process.cwd(), bundle)} — ${(fs.statSync(bundle).size / 1024 / 1024).toFixed(1)} MB`);
