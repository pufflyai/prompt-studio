import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, fingerprint } from "./fingerprint";
import type { Json } from "./json";

test("native and browser fingerprints retain the same canonical SHA-256 wire identity", async () => {
  const root = mkdtempSync(join(tmpdir(), "storage-fingerprint-"));
  try {
    const built = await Bun.build({
      entrypoints: [join(import.meta.dir, "fingerprint.ts")],
      target: "browser",
      outdir: root,
      define: { Bun: "undefined" },
    });
    expect(built.success).toBe(true);
    const browser = (await import(join(root, "fingerprint.js"))) as typeof import("./fingerprint");
    const values: Json[] = [
      null,
      true,
      0,
      "Unicode: λ, 中文, 🧪",
      ["ordered", false, null, 42],
      { second: { content: "line one\nline two", empty: [] }, first: "retained" },
    ];
    for (const value of values) {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalJson(value)));
      const expected = Buffer.from(digest).toString("hex");
      expect(await fingerprint(value)).toBe(expected);
      expect(await browser.fingerprint(value)).toBe(expected);
    }
    expect(await fingerprint({ first: 1, second: 2 })).toBe(await browser.fingerprint({ second: 2, first: 1 }));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
