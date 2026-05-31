import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { existsSync, lstatSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installExtensionSource } from "./install-extension-source";

const writeExtension = (dir: string) => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify(
      {
        name: "source-extension",
        version: "1.2.3",
        displayName: "Source Extension",
        publisher: "test",
        main: "./extension.ts",
        engines: { pstdio: "^1.0.0" },
        type: "module",
        packageManager: "bun@1.3.13",
        dependencies: { "@pstdio/sdk": "^0.8.0" },
      },
      null,
      2,
    ),
  );
  writeFileSync(join(dir, "extension.ts"), "export default {};\n");
};

let root: string;
let pstdioHome: string;

beforeEach(() => {
  root = join(tmpdir(), `pstdio-extension-install-deps-test-${crypto.randomUUID()}`);
  pstdioHome = join(root, "home");
  mkdirSync(root, { recursive: true });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("installExtensionSource dependency health", () => {
  test("links ancestor node_modules for skip-install local workspace sources", async () => {
    const workspaceRoot = join(root, "workspace");
    const source = join(workspaceRoot, "extensions", "source-extension");
    writeExtension(source);
    writeFileSync(
      join(source, "extension.ts"),
      `import { defineExtension } from "@pstdio/sdk/extensions";

export default defineExtension({
  commands: {
    hello: {
      title: "Hello",
      run() {
        return { ok: true };
      },
    },
  },
});
`,
    );

    const sdkPath = join(workspaceRoot, "node_modules", "@pstdio", "sdk");
    mkdirSync(sdkPath, { recursive: true });
    writeFileSync(
      join(sdkPath, "package.json"),
      JSON.stringify({ name: "@pstdio/sdk", type: "module", exports: { "./extensions": "./extensions.js" } }),
    );
    writeFileSync(join(sdkPath, "extensions.js"), "export const defineExtension = (extension) => extension;\n");

    const result = await installExtensionSource({
      source,
      skipInstall: true,
      env: { PSTDIO_HOME: pstdioHome },
      homedir: () => "/unused",
    });

    const targetNodeModules = join(result.targetPath, "node_modules");
    expect(result.check.errorCount).toBe(0);
    expect(existsSync(targetNodeModules)).toBe(true);
    expect(lstatSync(targetNodeModules).isSymbolicLink()).toBe(true);
  });

  test("reuses an existing install but reinstalls deps when a declared dependency is missing", async () => {
    const source = join(root, "source-extension");
    writeExtension(source);

    await installExtensionSource({
      source,
      skipInstall: true,
      env: { PSTDIO_HOME: pstdioHome },
      homedir: () => "/unused",
    });

    const target = join(pstdioHome, "extensions", "source-extension");
    mkdirSync(join(target, "node_modules", "@pstdio"), { recursive: true });
    symlinkSync(join(root, "missing-sdk"), join(target, "node_modules", "@pstdio", "sdk"), "dir");

    const runCommand = mock(async (_file: string, _args: readonly string[], options: { cwd: string }) => {
      rmSync(join(options.cwd, "node_modules", "@pstdio", "sdk"), { force: true });
      mkdirSync(join(options.cwd, "node_modules", "@pstdio", "sdk"), { recursive: true });
      return { exitCode: 0, stderr: "", stdout: "" };
    });

    await installExtensionSource({
      source,
      existsOk: true,
      env: { PSTDIO_HOME: pstdioHome },
      homedir: () => "/unused",
      isCommandAvailable: async () => true,
      runCommand,
    });

    expect(runCommand).toHaveBeenCalledTimes(1);
  });
});
