import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
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
    writeManifest(source, { engines: { pstdio: "1.0.0-alpha.999" }, packageManager: "bun@1.3.13" });
    const runCommand = mock(async () => ({ exitCode: 0, stderr: "", stdout: "" }));

    await expect(installExtensionSource({ source, env: { PSTDIO_HOME: pstdioHome }, runCommand })).rejects.toThrow(
      "1.0.0-alpha.999",
    );

    expect(existsSync(join(pstdioHome, "extensions", "source-extension"))).toBe(false);
    expect(runCommand).not.toHaveBeenCalled();
  });

  test("keeps an incompatible managed extension installed for dashboard recovery", async () => {
    const source = join(root, "old-planner");
    makeExtension(source, {
      namespace: "pstdio-planner",
      name: "Prompt Studio Planner",
      engines: { pstdio: "1.0.0-alpha.1" },
      version: "0.10.0",
    });

    const result = await installExtensionSource({
      allowUnsupportedApiVersion: true,
      env: { PSTDIO_HOME: pstdioHome },
      skipInstall: true,
      source,
    });

    expect(result.metadata).toMatchObject({
      enginesPstdio: "1.0.0-alpha.1",
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
