import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { verifyBoundaries } from "./verify-boundaries";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const write = (root: string, file: string, content: unknown) => {
  const target = path.join(root, file);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, typeof content === "string" ? content : JSON.stringify(content, null, 2));
};

// A minimal workspace: the public SDK and UI packages plus whatever the test adds.
const createWorkspace = (files: Record<string, unknown>) => {
  const root = mkdtempSync(path.join(tmpdir(), "verify-boundaries-"));
  roots.push(root);
  const workspaces = ["packages", "extensions", "clients"];
  for (const dir of workspaces) mkdirSync(path.join(root, dir));
  write(root, "package.json", { private: true, workspaces: workspaces.map((dir) => `${dir}/*`) });
  write(root, "packages/sdk/package.json", { name: "@pstdio/sdk", dependencies: {} });
  write(root, "packages/sdk/src/extensions/index.ts", "export const sdk = 1;\n");
  write(root, "packages/ui/package.json", { name: "@pstdio/ui", dependencies: { "@pstdio/sdk": "workspace:*" } });
  for (const [file, content] of Object.entries(files)) write(root, file, content);
  return root;
};

describe("verifyBoundaries", () => {
  test("rejects an extension tsconfig path that resolves SDK source instead of the released package", () => {
    const root = createWorkspace({
      "extensions/example/package.json": {
        name: "example",
        engines: { pstdio: "*" },
        dependencies: { "@pstdio/sdk": "^0.35.0" },
      },
      "extensions/example/tsconfig.json": {
        compilerOptions: { paths: { "@pstdio/sdk/extensions": ["../../packages/sdk/src/extensions/index.ts"] } },
      },
    });

    expect(verifyBoundaries(root)).toContainEqual(
      expect.stringContaining('extensions/example/tsconfig.json: path "@pstdio/sdk/extensions"'),
    );
  });

  test("allows a tsconfig path that stays inside its package", () => {
    const root = createWorkspace({
      "extensions/example/package.json": { name: "example", engines: { pstdio: "*" } },
      "extensions/example/tsconfig.json": { compilerOptions: { paths: { "@/*": ["./src/*"] } } },
    });

    expect(verifyBoundaries(root).filter((error) => error.includes("tsconfig"))).toEqual([]);
  });

  test("rejects any @pstdio/ui specifier in workbench core, including subpaths and type imports", () => {
    const root = createWorkspace({
      "packages/pstdio-workbench/package.json": {
        name: "@pstdio/workbench",
        dependencies: { "@pstdio/sdk": "workspace:*", "@pstdio/ui": "workspace:*" },
      },
      "packages/pstdio-workbench/src/core/terminal.ts": 'import type { Terminal } from "@pstdio/ui/terminal";\n',
      "packages/pstdio-workbench/src/extensions/kanban.ts": 'import { Kanban } from "@pstdio/ui/kanban-renderer";\n',
    });

    const errors = verifyBoundaries(root);

    expect(errors).toContainEqual(
      expect.stringContaining('src/core/terminal.ts: workbench core must not import "@pstdio/ui/terminal"'),
    );
    expect(errors.filter((error) => error.includes("src/extensions/kanban.ts"))).toEqual([]);
  });

  test("rejects a layer-map allowance the package does not declare", () => {
    const root = createWorkspace({ "packages/ui/package.json": { name: "@pstdio/ui", dependencies: {} } });

    expect(verifyBoundaries(root)).toContainEqual(
      expect.stringContaining('packages/ui: layer map allows "@pstdio/sdk" but the package does not declare it'),
    );
  });

  test("rejects importing a client package by name", () => {
    const root = createWorkspace({
      "clients/desktop/package.json": { name: "@pstdio/desktop" },
      "packages/sdk/src/uses-client.ts": 'import "@pstdio/desktop/main";\n',
    });

    expect(verifyBoundaries(root)).toContainEqual(
      expect.stringContaining('uses-client.ts: imports from clients/* ("@pstdio/desktop/main")'),
    );
  });

  test("rejects a private package that exports more internal subpaths than its limit", () => {
    const exports = Object.fromEntries(["./a", "./b", "./c"].map((key) => [key, `${key}.ts`]));
    const root = createWorkspace({
      "packages/pstdio-wt/package.json": { name: "pstdio-wt", private: true, exports },
    });

    expect(verifyBoundaries(root)).toContainEqual(
      expect.stringContaining("packages/pstdio-wt: private package exports 3 subpaths; the limit is 2"),
    );
  });
});
