import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type BoundaryConfig, verifyBoundaries } from "./boundary-verifier";

const roots: string[] = [];

const testConfig = (overrides: Partial<BoundaryConfig> = {}): BoundaryConfig => ({
  allowedWorkspaceDeps: {},
  contentDenylistRules: [],
  extensionAllowedDeps: [],
  forbiddenSpecifiers: {},
  fixtureSourceFiles: [],
  packageLayers: {},
  relativeEscapeAllowlist: [],
  specifierDenylistRules: [],
  ...overrides,
});

const createRoot = () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-boundaries-"));
  roots.push(root);
  for (const dir of ["packages", "extensions", "clients", "scripts"]) {
    mkdirSync(join(root, dir), { recursive: true });
  }
  return root;
};

const writePackage = (
  root: string,
  dir: string,
  input: { name: string; dependencies?: Record<string, string>; source?: Record<string, string> },
) => {
  const packageRoot = join(root, dir);
  mkdirSync(packageRoot, { recursive: true });
  writeFileSync(
    join(packageRoot, "package.json"),
    JSON.stringify({ name: input.name, type: "module", dependencies: input.dependencies ?? {} }, null, 2),
  );
  for (const [file, source] of Object.entries(input.source ?? {})) {
    const filePath = join(packageRoot, file);
    mkdirSync(join(filePath, ".."), { recursive: true });
    writeFileSync(filePath, source);
  }
};

const hasError = (errors: string[], parts: string[]) =>
  errors.some((error) => parts.every((part) => error.includes(part)));

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("verifyBoundaries", () => {
  test("reports declared dependencies that point to a higher package layer", () => {
    const root = createRoot();
    writePackage(root, "packages/foundation", { name: "foundation", dependencies: { product: "workspace:*" } });
    writePackage(root, "packages/product", { name: "product" });

    const result = verifyBoundaries({
      root,
      config: testConfig({
        allowedWorkspaceDeps: { foundation: ["product"], product: [] },
        packageLayers: { foundation: 0, product: 2 },
      }),
    });

    expect(hasError(result.errors, ["foundation", "product", "higher layer"])).toBe(true);
  });

  test("reports denied domain tokens in framework package sources", () => {
    const root = createRoot();
    writePackage(root, "packages/framework", {
      name: "framework",
      source: { "src/leak.ts": 'export const ticketLabel = "ticket";' },
    });

    const result = verifyBoundaries({
      root,
      config: testConfig({
        allowedWorkspaceDeps: { framework: [] },
        contentDenylistRules: [
          {
            packageName: "framework",
            deniedContent: [{ label: "ticket", pattern: /\btickets?\b/i }],
            label: "domain vocabulary",
            pathPrefixes: ["src"],
          },
        ],
        packageLayers: { framework: 1 },
      }),
    });

    expect(hasError(result.errors, ["packages/framework/src/leak.ts", "domain vocabulary", "ticket"])).toBe(true);
  });

  test("uses parsed specifiers for workbench core UI import checks", () => {
    const root = createRoot();
    writePackage(root, "packages/ui", { name: "@pstdio/ui" });
    writePackage(root, "packages/pstdio-workbench", {
      name: "pstdio-workbench",
      dependencies: { "@pstdio/ui": "workspace:*" },
      source: { "src/core/reexport.ts": 'export { Box } from "@pstdio/ui/components";' },
    });

    const result = verifyBoundaries({
      root,
      config: testConfig({
        allowedWorkspaceDeps: { "@pstdio/ui": [], "pstdio-workbench": ["@pstdio/ui"] },
        packageLayers: { "@pstdio/ui": 0, "pstdio-workbench": 1 },
        specifierDenylistRules: [
          {
            forbiddenSpecifiers: ["@pstdio/ui"],
            packageName: "pstdio-workbench",
            pathPrefixes: ["src/core"],
          },
        ],
      }),
    });

    expect(hasError(result.errors, ["packages/pstdio-workbench/src/core/reexport.ts", "@pstdio/ui"])).toBe(true);
  });

  test("rejects type-only UI imports in workbench core", () => {
    const root = createRoot();
    writePackage(root, "packages/ui", { name: "@pstdio/ui" });
    writePackage(root, "packages/pstdio-workbench", {
      name: "pstdio-workbench",
      dependencies: { "@pstdio/ui": "workspace:*" },
      source: { "src/core/type-import.ts": 'import type { Box } from "@pstdio/ui"; export type CoreBox = Box;' },
    });

    const result = verifyBoundaries({
      root,
      config: testConfig({
        allowedWorkspaceDeps: { "@pstdio/ui": [], "pstdio-workbench": ["@pstdio/ui"] },
        packageLayers: { "@pstdio/ui": 0, "pstdio-workbench": 1 },
        specifierDenylistRules: [
          {
            forbiddenSpecifiers: ["@pstdio/ui"],
            packageName: "pstdio-workbench",
            pathPrefixes: ["src/core"],
          },
        ],
      }),
    });

    expect(hasError(result.errors, ["packages/pstdio-workbench/src/core/type-import.ts", "@pstdio/ui"])).toBe(true);
  });

  test("allows type-only specifier escapes while rejecting runtime imports", () => {
    const root = createRoot();
    writePackage(root, "packages/pstdio-workbench", {
      name: "pstdio-workbench",
      source: {
        "src/core/runtime.ts": 'import { useState } from "react"; export const state = useState;',
        "src/core/type-only.ts": 'import type { ReactNode } from "react"; export type Node = ReactNode;',
      },
    });

    const result = verifyBoundaries({
      root,
      config: testConfig({
        allowedWorkspaceDeps: { "pstdio-workbench": [] },
        packageLayers: { "pstdio-workbench": 1 },
        specifierDenylistRules: [
          {
            forbiddenSpecifiers: ["react"],
            packageName: "pstdio-workbench",
            allowTypeOnlySpecifiers: ["react"],
            pathPrefixes: ["src/core"],
          },
        ],
      }),
    });

    expect(hasError(result.errors, ["packages/pstdio-workbench/src/core/runtime.ts", "react"])).toBe(true);
    expect(hasError(result.errors, ["packages/pstdio-workbench/src/core/type-only.ts", "react"])).toBe(false);
  });

  test("matches prefix specifier bans like node:", () => {
    const root = createRoot();
    writePackage(root, "packages/ui", {
      name: "@pstdio/ui",
      source: { "src/fs.ts": 'import { readFile } from "node:fs"; export const read = readFile;' },
    });

    const result = verifyBoundaries({
      root,
      config: testConfig({
        allowedWorkspaceDeps: { "@pstdio/ui": [] },
        packageLayers: { "@pstdio/ui": 1 },
        specifierDenylistRules: [
          {
            forbiddenSpecifiers: ["node:"],
            packageName: "@pstdio/ui",
            pathPrefixes: ["src"],
          },
        ],
      }),
    });

    expect(hasError(result.errors, ["packages/ui/src/fs.ts", "node:fs"])).toBe(true);
  });

  test("reports declared workspace dependency cycles", () => {
    const root = createRoot();
    writePackage(root, "packages/a", { name: "a", dependencies: { b: "workspace:*" } });
    writePackage(root, "packages/b", { name: "b", dependencies: { a: "workspace:*" } });

    const result = verifyBoundaries({
      root,
      config: testConfig({
        allowedWorkspaceDeps: { a: ["b"], b: ["a"] },
        packageLayers: { a: 1, b: 0 },
      }),
    });

    expect(hasError(result.errors, ["package cycle", "a -> b -> a"])).toBe(true);
  });

  test("respects relative import escape allowlist entries", () => {
    const root = createRoot();
    writePackage(root, "packages/pkg", {
      name: "pkg",
      source: {
        "src/allowed.ts": 'import "../../outside";',
        "src/blocked.ts": 'import "../../outside";',
      },
    });

    const result = verifyBoundaries({
      root,
      config: testConfig({
        allowedWorkspaceDeps: { pkg: [] },
        packageLayers: { pkg: 1 },
        relativeEscapeAllowlist: ["packages/pkg/src/allowed.ts"],
      }),
    });

    expect(hasError(result.errors, ["packages/pkg/src/allowed.ts", "escapes"])).toBe(false);
    expect(hasError(result.errors, ["packages/pkg/src/blocked.ts", "escapes"])).toBe(true);
  });

  test("skips fixture source files before checking denied content", () => {
    const root = createRoot();
    writePackage(root, "packages/framework", {
      name: "framework",
      source: { "src/fixture.ts": 'export const ticketLabel = "ticket";' },
    });

    const result = verifyBoundaries({
      root,
      config: testConfig({
        allowedWorkspaceDeps: { framework: [] },
        contentDenylistRules: [
          {
            packageName: "framework",
            deniedContent: [{ label: "ticket", pattern: /\btickets?\b/i }],
            label: "domain vocabulary",
            pathPrefixes: ["src"],
          },
        ],
        fixtureSourceFiles: ["packages/framework/src/fixture.ts"],
        packageLayers: { framework: 1 },
      }),
    });

    expect(result.errors).toEqual([]);
  });

  test("accepts the current tree with the default boundary config", () => {
    const result = verifyBoundaries();

    expect(result.errors).toEqual([]);
  });
});
