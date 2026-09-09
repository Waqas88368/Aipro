// Wrap the traced brand wordmark SVG into a Liquid snippet that inherits currentColor.
import fs from 'node:fs';
const [src, dest] = process.argv.slice(2);
const svg = fs.readFileSync(src, 'utf8');
const paths = [...svg.matchAll(/<path[^>]*d="([^"]+)"[^>]*>/g)].map((m) => `  <path d="${m[1]}"/>`).join('\n');
const out = `{%- comment -%}
  LINUX wordmark, traced from the brand logotype. Inline so it inherits
  currentColor. Usage: {% render 'brand-logo', class: 'x', height: 22 %}
{%- endcomment -%}
{%- assign h = height | default: 24 -%}
{%- assign w = h | times: 3.945 | round -%}
<svg class="brand-logo{% if class %} {{ class }}{% endif %}" width="{{ w }}" height="{{ h }}" viewBox="0 0 1361 345" fill="currentColor" fill-rule="evenodd" role="img" aria-label="{{ shop.name | escape }}" focusable="false">
${paths}
</svg>
`;
fs.writeFileSync(dest, out);
console.log('wrote', dest, out.length, 'bytes');
