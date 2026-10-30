import { expect, test } from "bun:test";
import { findGeneratedFiles } from "./pr-change-guards";

test("rejects generated files that are not an allowed exception", () => {
  expect(
    findGeneratedFiles([
      "extensions/canvas/src/catalog/generated/frame-manifest.json",
      "packages/ui/dist/index.js",
      "packages/ui/storybook-static/index.html",
      "packages/ui/src/button.tsx",
    ]),
  ).toEqual([
    "extensions/canvas/src/catalog/generated/frame-manifest.json",
    "packages/ui/dist/index.js",
    "packages/ui/storybook-static/index.html",
  ]);
});

test("allows the listed exceptions", () => {
  expect(
    findGeneratedFiles([
      "packages/pstdio-extensions/src/bridge/webview-runtime/runtime.bundle.js",
      "bun.lock",
      "extensions/notes/bun.lock",
      "packages/pstdio-db/drizzle/0003_new.sql",
      "extensions/harness-codex/src/protocol/v2/Item.ts",
    ]),
  ).toEqual([]);
});
