import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { check } from '@shopify/theme-check-node';

const here = path.dirname(fileURLToPath(import.meta.url));
const themeRoot = path.resolve(here, '..', '..', 'theme');
const offenses = await check(themeRoot);
for (const o of offenses.filter((x) => x.check === 'LiquidSyntaxError')) {
  console.log(path.relative(themeRoot, fileURLToPath(o.uri)), JSON.stringify(o.start), JSON.stringify(o.end));
  console.log('  ', o.message);
}
