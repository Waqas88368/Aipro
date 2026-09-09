// Downloads variable WOFF2 subsets from Google Fonts (all OFL-licensed) into
// theme/assets so the theme self-hosts its type. Run once; commit the files.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.resolve(here, '..', '..', 'theme', 'assets');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

// family → { css2 spec, subsets to keep, output name }
const FAMILIES = [
  { spec: 'Unbounded:wght@400..900', keep: ['latin', 'latin-ext'], out: 'unbounded' },
  { spec: 'Space+Grotesk:wght@300..700', keep: ['latin', 'latin-ext'], out: 'space-grotesk' },
  { spec: 'Cairo:wght@300..900', keep: ['arabic', 'latin'], out: 'cairo' },
  { spec: 'Readex+Pro:wght@200..700', keep: ['arabic', 'latin'], out: 'readex-pro' },
  { spec: 'JetBrains+Mono:wght@400..700', keep: ['latin'], out: 'jetbrains-mono' },
];

const SUBSET_RANGES = {
  latin: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
  'latin-ext': 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF',
  arabic: 'U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC, U+102E0-102FB, U+10E60-10E7E, U+10EC2-10EC4, U+10EFC-10EFF, U+1EE00-1EE03, U+1EE05-1EE1F, U+1EE21-1EE22, U+1EE24, U+1EE27, U+1EE29-1EE32, U+1EE34-1EE37, U+1EE39, U+1EE3B, U+1EE42, U+1EE47, U+1EE49, U+1EE4B, U+1EE4D-1EE4F, U+1EE51-1EE52, U+1EE54, U+1EE57, U+1EE59, U+1EE5B, U+1EE5D, U+1EE5F, U+1EE61-1EE62, U+1EE64, U+1EE67-1EE6A, U+1EE6C-1EE72, U+1EE74-1EE77, U+1EE79-1EE7C, U+1EE7E, U+1EE80-1EE89, U+1EE8B-1EE9B, U+1EEA1-1EEA3, U+1EEA5-1EEA9, U+1EEAB-1EEBB, U+1EEF0-1EEF1',
};

const faces = [];
for (const fam of FAMILIES) {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${fam.spec}&display=swap`, { headers: { 'User-Agent': UA } })).text();
  // blocks look like: /* latin */ @font-face { ... src: url(...) format('woff2'); unicode-range: ...; }
  const blocks = [...css.matchAll(/\/\* ([a-z-]+) \*\/\s*@font-face \{([\s\S]*?)\}/g)];
  for (const [, subset, body] of blocks) {
    if (!fam.keep.includes(subset)) continue;
    const url = body.match(/url\((https:[^)]+)\)/)[1];
    const weight = body.match(/font-weight: ([^;]+);/)[1].trim();
    const family = body.match(/font-family: '([^']+)';/)[1];
    const file = `${fam.out}-${subset}.woff2`;
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    fs.writeFileSync(path.join(ASSETS, file), buf);
    faces.push({ family, file, weight, range: SUBSET_RANGES[subset] });
    console.log(`${file}  ${(buf.length / 1024).toFixed(0)} KB  ${weight}`);
  }
}
fs.writeFileSync(path.join(here, 'fonts.json'), JSON.stringify(faces, null, 2));
