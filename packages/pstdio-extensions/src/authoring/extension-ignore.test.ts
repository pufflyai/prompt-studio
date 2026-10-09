import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExtensionIgnoreMatcher } from "./extension-ignore";

const withExtensionRoot = (setup: (root: string) => void) => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-extension-ignore-test-"));
  setup(root);
  return root;
};

describe("createExtensionIgnoreMatcher", () => {
  test("uses extension-local .gitignore rules", () => {
    const root = withExtensionRoot((dir) => {
      writeFileSync(join(dir, ".gitignore"), "node_modules/\ndist/\n*.log\nsrc/generated/**\n");
    });

    try {
      const matcher = createExtensionIgnoreMatcher(root);

      expect(matcher.ignores("node_modules/pkg/index.js")).toBe(true);
      expect(matcher.ignores("packages/node_modules/pkg/index.js")).toBe(true);
      expect(matcher.ignores("dist/lab-page.html")).toBe(true);
      expect(matcher.ignores("debug.log")).toBe(true);
      expect(matcher.ignores("src/generated/client.ts")).toBe(true);
      expect(matcher.ignores("src/main.ts")).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("always ignores git metadata even without .gitignore", () => {
    const root = withExtensionRoot(() => {});

    try {
      const matcher = createExtensionIgnoreMatcher(root);

      expect(matcher.ignores(".git")).toBe(true);
      expect(matcher.ignores(".git/HEAD")).toBe(true);
      expect(matcher.ignores("extension.ts")).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("does not hard-code generated directories", () => {
    const root = withExtensionRoot((dir) => {
      mkdirSync(join(dir, "dist"), { recursive: true });
    });

    try {
      const matcher = createExtensionIgnoreMatcher(root);

      expect(matcher.ignores("dist/lab-page.html")).toBe(false);
      expect(matcher.ignores(".turbo/cache")).toBe(false);
      expect(matcher.ignores(".next/server.js")).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("ignores dev-only files from installed extension copies", () => {
    const root = withExtensionRoot((dir) => {
      mkdirSync(join(dir, "src", "mocks"), { recursive: true });
      writeFileSync(join(dir, "extension.ts"), "export default {};");
      writeFileSync(join(dir, "extension.test.ts"), "");
      writeFileSync(join(dir, "src", "context.fixture.ts"), "");
      writeFileSync(join(dir, "src", "worker.test-helpers.ts"), "");
      writeFileSync(join(dir, "src", "mocks", "session.jsonl"), "");
    });

    try {
      const matcher = createExtensionIgnoreMatcher(root);

      expect(matcher.ignores("extension.ts")).toBe(false);
      expect(matcher.ignores("extension.test.ts")).toBe(true);
      expect(matcher.ignores("src/context.fixture.ts")).toBe(true);
      expect(matcher.ignores("src/worker.test-helpers.ts")).toBe(true);
      expect(matcher.ignores("src/mocks/session.jsonl")).toBe(true);
      expect(matcher.ignores("node_modules/dependency/index.js")).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
