import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installExtensionSource } from "./install-extension-source";
import { makeExtension, writeManifest } from "./install-extension-source-test-fixtures";

let root: string;
let pstdioHome: string;

beforeEach(() => {
  root = join(tmpdir(), `pstdio-extension-validation-test-${crypto.randomUUID()}`);
  pstdioHome = join(root, "home");
  mkdirSync(root, { recursive: true });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("installExtensionSource API version gate", () => {
  test("refuses an extension built for another API version and leaves the root untouched", async () => {
    const source = join(root, "source-extension");
    makeExtension(source);
    writeManifest(source, { engines: { pstdio: "^0.2.0" }, packageManager: "bun@1.3.13" });
    const runCommand = mock(async () => ({ exitCode: 0, stderr: "", stdout: "" }));

    await expect(installExtensionSource({ source, env: { PSTDIO_HOME: pstdioHome }, runCommand })).rejects.toThrow(
      "^0.2.0",
    );

    expect(existsSync(join(pstdioHome, "extensions", "source-extension"))).toBe(false);
    expect(runCommand).not.toHaveBeenCalled();
  });

  test("keeps an incompatible managed extension installed for dashboard recovery", async () => {
    const source = join(root, "old-planner");
    makeExtension(source, {
      namespace: "pstdio-planner",
      name: "Prompt Studio Planner",
      engines: { pstdio: "^0.0.9" },
      version: "0.10.0",
    });

    const result = await installExtensionSource({
      allowUnsupportedApiVersion: true,
      env: { PSTDIO_HOME: pstdioHome },
      skipInstall: true,
      source,
    });

    expect(result.metadata).toMatchObject({
      enginesPstdio: "^0.0.9",
      name: "pstdio-planner",
      version: "0.10.0",
    });
    expect(result.check.diagnostics).toEqual([
      expect.objectContaining({ code: "extension_manifest_unsupported_api_version" }),
    ]);
    expect(existsSync(join(pstdioHome, "extensions", "old-planner", "package.json"))).toBe(true);
  });
});

describe("installExtensionSource dependency reinstall", () => {
  test("reuses an existing install but reinstalls deps when node_modules is missing", async () => {
    const source = join(root, "source-extension");
    makeExtension(source);
    writeManifest(source, { packageManager: "bun@1.3.13" });
    const runCommand = mock(async (_file: string, _args: readonly string[], options: { cwd: string }) => {
      mkdirSync(join(options.cwd, "node_modules"), { recursive: true });
      return { exitCode: 0, stderr: "", stdout: "" };
    });

    await installExtensionSource({ source, env: { PSTDIO_HOME: pstdioHome }, homedir: () => "/unused", runCommand });
    expect(runCommand).toHaveBeenCalledTimes(1);
    rmSync(join(pstdioHome, "extensions", "source-extension", "node_modules"), { recursive: true, force: true });

    await installExtensionSource({
      source,
      existsOk: true,
      env: { PSTDIO_HOME: pstdioHome },
      homedir: () => "/unused",
      runCommand,
    });

    expect(runCommand).toHaveBeenCalledTimes(2);
    expect(existsSync(join(pstdioHome, "extensions", "source-extension", "node_modules"))).toBe(true);
  });

  test("reuses an existing install and skips dep install when node_modules already exists", async () => {
    const source = join(root, "source-extension");
    makeExtension(source);
    writeManifest(source, { packageManager: "bun@1.3.13" });
    const runCommand = mock(async (_file: string, _args: readonly string[], options: { cwd: string }) => {
      mkdirSync(join(options.cwd, "node_modules"), { recursive: true });
      return { exitCode: 0, stderr: "", stdout: "" };
    });

    await installExtensionSource({ source, env: { PSTDIO_HOME: pstdioHome }, homedir: () => "/unused", runCommand });
    expect(runCommand).toHaveBeenCalledTimes(1);

    await installExtensionSource({
      source,
      existsOk: true,
      env: { PSTDIO_HOME: pstdioHome },
      homedir: () => "/unused",
      runCommand,
    });

    expect(runCommand).toHaveBeenCalledTimes(1);
  });
});

describe("installExtensionSource package scripts", () => {
  test("never runs lifecycle scripts from a dropped folder that fails validation", async () => {
    const source = join(root, "dropped-extension");
    const marker = join(root, "script-ran");
    makeExtension(source);
    writeManifest(source, {
      scripts: {
        preinstall: `bun -e "require('node:fs').writeFileSync(process.argv[1], 'preinstall')" ${JSON.stringify(marker)}`,
        postinstall: `bun -e "require('node:fs').writeFileSync(process.argv[1], 'postinstall')" ${JSON.stringify(marker)}`,
      },
    });
    writeFileSync(join(source, "extension.ts"), 'throw new Error("invalid extension");\n');

    await expect(
      installExtensionSource({
        source,
        env: { HOME: root, PATH: process.env.PATH, PSTDIO_HOME: pstdioHome },
        homedir: () => root,
      }),
    ).rejects.toThrow("Extension validation failed");

    expect(existsSync(marker)).toBe(false);
    expect(existsSync(join(pstdioHome, "extensions", "dropped-extension"))).toBe(false);
  });
});
