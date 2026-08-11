import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installExtensionSource, removePathBestEffort } from "./install-extension-source";

let root: string;
let pstdioHome: string;
let source: string;
let target: string;

const writeExtension = (packageManager?: string) => {
  mkdirSync(source, { recursive: true });
  writeFileSync(
    join(source, "package.json"),
    JSON.stringify({
      name: "source-extension",
      version: "1.0.0",
      displayName: "Source Extension",
      publisher: "test",
      main: "./extension.ts",
      engines: { pstdio: "^1.0.0" },
      dependencies: { example: "1.0.0" },
      ...(packageManager ? { packageManager } : {}),
    }),
  );
  writeFileSync(join(source, "extension.ts"), "export default { commands: {} };");
};

const writeExistingInstall = () => {
  mkdirSync(join(target, "node_modules"), { recursive: true });
  writeFileSync(join(target, "extension.ts"), "export default { old: true };");
  writeFileSync(join(target, "old.txt"), "old");
};

beforeEach(() => {
  root = join(tmpdir(), `pstdio-extension-replacement-test-${crypto.randomUUID()}`);
  pstdioHome = join(root, "home");
  source = join(root, "source-extension");
  target = join(pstdioHome, "extensions", "source-extension");
  writeExtension();
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("installExtensionSource replacement", () => {
  test("does not let cleanup errors replace the install result", () => {
    const remove = mock(() => {
      throw new Error("cleanup failed");
    });

    expect(() => removePathBestEffort("/locked/staging", remove)).not.toThrow();
    expect(remove).toHaveBeenCalledWith("/locked/staging");
  });

  test("force=true replaces an existing install", async () => {
    writeExistingInstall();

    const result = await installExtensionSource({
      source,
      force: true,
      skipInstall: true,
      env: { PSTDIO_HOME: pstdioHome },
      homedir: () => "/unused",
    });

    expect(result.targetPath).toBe(target);
    expect(existsSync(join(target, "old.txt"))).toBe(false);
  });

  test("keeps the live install available while preparing its replacement", async () => {
    writeExistingInstall();
    const runCommand = mock(async (_file: string, _args: readonly string[], options: { cwd: string }) => {
      expect(options.cwd).not.toBe(target);
      expect(readFileSync(join(target, "extension.ts"), "utf8")).toContain("old: true");
      expect(existsSync(join(target, "old.txt"))).toBe(true);
      mkdirSync(join(options.cwd, "node_modules", "example"), { recursive: true });
      return { exitCode: 0, stderr: "", stdout: "" };
    });

    await installExtensionSource({
      source,
      force: true,
      env: { PSTDIO_HOME: pstdioHome },
      homedir: () => "/unused",
      runCommand,
    });

    expect(readFileSync(join(target, "extension.ts"), "utf8")).toContain("commands");
    expect(existsSync(join(target, "old.txt"))).toBe(false);
  });

  test("preserves the live install when replacement preparation fails", async () => {
    writeExistingInstall();

    await expect(
      installExtensionSource({
        source,
        force: true,
        env: { PSTDIO_HOME: pstdioHome },
        homedir: () => "/unused",
        runCommand: mock(async () => ({ exitCode: 1, stderr: "registry unavailable", stdout: "" })),
      }),
    ).rejects.toThrow("Dependency install failed");

    expect(readFileSync(join(target, "extension.ts"), "utf8")).toContain("old: true");
    expect(readFileSync(join(target, "old.txt"), "utf8")).toBe("old");
    expect(readdirSync(pstdioHome).filter((name) => name.startsWith(".extension-install-"))).toEqual([]);
  });

  test("does not publish a new source when dependency installation fails", async () => {
    const runCommand = mock(async () => ({ exitCode: 1, stderr: "registry unavailable", stdout: "" }));

    await expect(
      installExtensionSource({
        source,
        env: { PSTDIO_HOME: pstdioHome },
        homedir: () => "/unused",
        runCommand,
      }),
    ).rejects.toThrow("Dependency install failed");

    expect(existsSync(join(target, "extension.ts"))).toBe(false);
    expect(runCommand).toHaveBeenCalledWith("bun", ["install"], {
      cwd: expect.stringContaining(join(pstdioHome, ".extension-install-")),
    });
  });
});
