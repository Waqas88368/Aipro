import assert from "node:assert/strict";
import { test } from "node:test";
import { createDiag } from "./logger.ts";

test("logger: password/token values are redacted even in nested meta", () => {
  const out: string[] = [];
  const diag = createDiag({
    dataDir: "/tmp/hoplite-diag-test-" + Math.random().toString(36).slice(2),
    secrets: ["tok_s3cr3t"],
  });
  const original = process.stdout.write;
  // capture the JSON line
  (process as unknown as { stdout: { write: (s: string) => boolean } }).stdout.write = (s: string) => {
    out.push(s);
    return true;
  };
  try {
    diag.error("test", { password: "p4ss", token: "tok_s3cr3t", nested: { authorization: "Bearer tok_s3cr3t" } });
  } finally {
    (process as unknown as { stdout: { write: (s: string) => boolean } }).stdout.write = original;
  }
  const line = out.join("");
  assert.ok(line.includes('"password":"[REDACTED]"'));
  assert.ok(line.includes('"authorization":"[REDACTED]"'));
  assert.ok(!line.includes("tok_s3cr3t"));
  assert.ok(!line.includes("p4ss"));
});

test("logger: unknown strings pass through", () => {
  const out: string[] = [];
  const diag = createDiag({ dataDir: "/tmp/hoplite-diag-test2-" + Math.random().toString(36).slice(2) });
  const original = process.stdout.write;
  (process as unknown as { stdout: { write: (s: string) => boolean } }).stdout.write = (s: string) => {
    out.push(s);
    return true;
  };
  try {
    diag.info("msg", { section: "transcript", rows: 3 });
  } finally {
    (process as unknown as { stdout: { write: (s: string) => boolean } }).stdout.write = original;
  }
  const line = out.join("");
  assert.ok(line.includes('"rows":3'));
});
