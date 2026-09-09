// Probe: inside {% render %}, does a filter see this.context.environments or this.context.globals?
import { Liquid } from 'liquidjs';
const engine = new Liquid({ root: '/tmp', extname: '.liquid', fs: { readFileSync: () => "{{ 'k' | probe }}", existsSync: () => true, resolve: (r, f) => f, contains: () => true, exists: async () => true, readFile: async () => "{{ 'k' | probe }}" } });
engine.registerFilter('probe', function () {
  return `env=${this.context.environments.__locale} globals=${this.context.globals?.__locale} scope=${this.context.get(['__locale'])}`;
});
console.log('top   :', await engine.parseAndRender("{{ 'k' | probe }}", { __locale: 'ar' }, { globals: { __locale: 'ar' } }));
console.log('render:', await engine.parseAndRender("{% render 'x' %}", { __locale: 'ar' }, { globals: { __locale: 'ar' } }));
