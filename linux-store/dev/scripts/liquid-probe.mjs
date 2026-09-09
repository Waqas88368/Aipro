import { Liquid } from 'liquidjs';

const e = new Liquid({ jsTruthy: false, strictFilters: false, strictVariables: false });
const tpl = `
[{% if x == blank %}xblank{% endif %}]
[{% if s != blank %}snotblank{% endif %}]
[{% if arr == empty %}arrempty{% endif %}]
[{{ arr2.first }}|{{ arr2.last }}|{{ arr2.size }}]
[{% if form.posted_successfully? %}posted{% endif %}]
[{{ obj.a.b | default: 'dflt' }}]

[{{ "a b" | handleize }}|{{ 'x' | t }}]
[{% for item in arr2 limit: 1 offset: 1 %}{{ item }}{% endfor %}]
[{% assign f = arr2 | where: 'k', 'v' %}{{ f.size }}]
[{{ 1234.5 | round: 2 }}|{{ 64900 | divided_by: 100.0 | round: 2 }}]
[{% assign m = 'a,b' | split: ',' %}{% if m contains 'a' %}has{% endif %}]
[{% unless nothing %}unless-ok{% endunless %}]
[{{ 'now' | date: '%Y' }}]
[{{ arr2 | map: 'k' | join: ',' }}]
[{% if 5 > 3 and 2 < 3 %}andok{% endif %}]
[{% assign xx = 'Hello' | append: ' W' | upcase %}{{ xx }}]
[{{ some.deep | json }}]
[{% capture c %}{{ 'x' }}{% endcapture %}{{ c | size }}]
[{% increment ctr %}{% increment ctr %}]
`;
const out = await e.parseAndRender(tpl, {
  x: undefined, s: 'hi', arr: [], arr2: [{ k: 'v' }, { k: 'w' }], form: { 'posted_successfully?': true }, obj: {}, some: { deep: [1, 2] }
}).catch((err) => 'ERR ' + err.message);
console.log(out);
