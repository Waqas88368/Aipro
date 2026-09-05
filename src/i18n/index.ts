/** i18n helper — placeholder interpolation over the AR/EN catalogs. */
import { ar } from "./ar.ts";
import type { I18nKey } from "./ar.ts";
import { en } from "./en.ts";

export type { I18nKey } from "./ar.ts";
export type Lang = "ar" | "en";

const CATALOGS: Record<Lang, Record<I18nKey, string>> = { ar, en };

export function t(lang: Lang, key: I18nKey, params?: Record<string, string | number>): string {
  const template = CATALOGS[lang][key] ?? CATALOGS.ar[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const v = params[name];
    return v === undefined ? "" : String(v);
  });
}

/** Assert key parity between catalogs (used by tests and startup). */
export function catalogKeys(): { ar: I18nKey[]; en: I18nKey[] } {
  return { ar: Object.keys(ar) as I18nKey[], en: Object.keys(en) as I18nKey[] };
}
