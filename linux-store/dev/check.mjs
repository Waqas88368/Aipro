// Runs Shopify's official theme-check against ../theme and prints a compact report.
// Exit code 1 when any error-severity offense remains.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, Severity } from '@shopify/theme-check-node';

const here = path.dirname(fileURLToPath(import.meta.url));
const themeRoot = path.resolve(here, '..', 'theme');
const onlyErrors = process.argv.includes('--errors-only');

const offenses = await check(themeRoot);
const label = { [Severity.ERROR]: 'ERROR', [Severity.WARNING]: 'WARN', [Severity.INFO]: 'INFO' };

const byCheck = new Map();
for (const o of offenses) {
  if (onlyErrors && o.severity !== Severity.ERROR) continue;
  const key = `${label[o.severity]} ${o.check}`;
  if (!byCheck.has(key)) byCheck.set(key, []);
  byCheck.get(key).push(o);
}

const rel = (uri) => path.relative(themeRoot, fileURLToPath(uri));
for (const [key, list] of [...byCheck.entries()].sort()) {
  console.log(`\n${key} (${list.length})`);
  for (const o of list.slice(0, 40)) {
    const line = o.start?.line != null ? `:${o.start.line + 1}` : '';
    console.log(`  ${rel(o.uri)}${line}  ${o.message}`);
  }
  if (list.length > 40) console.log(`  … ${list.length - 40} more`);
}

const errors = offenses.filter((o) => o.severity === Severity.ERROR).length;
const warnings = offenses.filter((o) => o.severity === Severity.WARNING).length;
console.log(`\n${offenses.length} offenses: ${errors} errors, ${warnings} warnings, ${offenses.length - errors - warnings} info`);
process.exit(errors ? 1 : 0);
