import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyMonacoPackageAssets } from "./monaco-package-assets";

const installUiPackage = (files: Record<string, string>) => {
  const consumer = mkdtempSync(join(tmpdir(), "pstdio-monaco-assets-"));
  const ui = join(consumer, "node_modules/@pstdio/ui");
  mkdirSync(join(ui, "dist-monaco/assets"), { recursive: true });
  writeFileSync(
    join(ui, "package.json"),
    JSON.stringify({ name: "@pstdio/ui", exports: { "./monaco/*": "./dist-monaco/*" } }),
  );
  for (const [path, content] of Object.entries(files)) writeFileSync(join(ui, "dist-monaco", path), content);
  return consumer;
};

const monacoFiles = {
  "monaco.js":
    'new URL("assets/ts.worker-abc.js", import.meta.url); new URL("assets/editor.worker-def.js", import.meta.url);',
  "monaco.css": "@font-face { src: url(./assets/codicon-123.ttf) }",
  "assets/ts.worker-abc.js": "",
  "assets/editor.worker-def.js": "",
  "assets/codicon-123.ttf": "",
};

test("accepts an installed ui package whose Monaco files and assets resolve", () => {
  const consumer = installUiPackage(monacoFiles);
  try {
    expect(verifyMonacoPackageAssets(consumer)).toEqual({ workers: 2, fonts: 1 });
  } finally {
    rmSync(consumer, { recursive: true, force: true });
  }
});

test("rejects an installed ui package that is missing a Monaco worker", () => {
  const { "assets/ts.worker-abc.js": _, ...withoutWorker } = monacoFiles;
  const consumer = installUiPackage(withoutWorker);
  try {
    expect(() => verifyMonacoPackageAssets(consumer)).toThrow("assets/ts.worker-abc.js");
  } finally {
    rmSync(consumer, { recursive: true, force: true });
  }
});
