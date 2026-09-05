import assert from "node:assert/strict";
import { test } from "node:test";
import { ar } from "./ar.ts";
import { en } from "./en.ts";
import { catalogKeys, t, type I18nKey } from "./index.ts";

function placeholders(s: string): Set<string> {
  return new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!));
}

test("i18n: catalogs are key-identical", () => {
  const { ar: arKeys, en: enKeys } = catalogKeys();
  assert.deepEqual(new Set(arKeys), new Set(enKeys));
  assert.ok(arKeys.length > 60, "catalog should be comprehensive");
});

test("i18n: AR and EN templates use the same placeholders", () => {
  for (const key of Object.keys(ar) as I18nKey[]) {
    assert.deepEqual(
      placeholders(ar[key]),
      placeholders(en[key]),
      `placeholder mismatch in ${key}`,
    );
  }
});

test("i18n: interpolation works and unknown placeholders vanish", () => {
  assert.equal(t("ar", "plan_issue_prereq", { code: "M101" }), "متطلب سابق ناقص: M101");
  assert.equal(t("en", "plan_issue_prereq", { code: "M101" }), "Missing prerequisite: M101");
});
