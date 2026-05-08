import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ExtensionAlreadyInstalledError, installExtensionSource, resolvePstdioHome } from "./install-extension-source";

const makeExtension = (dir: string, fields: Partial<{ id: string; namespace: string; name: string }> = {}) => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "extension.ts"),
    `export default {
  id: "${fields.id ?? "test.extension"}",
  namespace: "${fields.namespace ?? "test"}",
  name: "${fields.name ?? "Test Extension"}",
  version: "1.2.3",
  apiVersion: "1",
  commands: {
    hello: {
      title: "Hello",
      run() {
        throw new Error("command handlers must not run during install");
      },
    },
  },
  templates: {
    ticket: {
      title: "Ticket",
      type: "ticket",
      source: { kind: "package-asset", path: "./ticket.md", baseUrl: import.meta.url },
    },
  },
};`,
  );
  writeFileSync(join(dir, "ticket.md"), "# ticket\n");
};

let root: string;
let pstdioHome: string;

beforeEach(() => {
  root = join(tmpdir(), `pstdio-extension-install-test-${crypto.randomUUID()}`);
  pstdioHome = join(root, "home");
  mkdirSync(root, { recursive: true });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("resolvePstdioHome", () => {
  test("uses PSTDIO_HOME when set", () => {
    expect(resolvePstdioHome({ env: { PSTDIO_HOME: join(root, "custom") }, homedir: () => "/home/user" })).toBe(
      join(root, "custom"),
    );
  });

  test("falls back to ~/.pstdio", () => {
    expect(resolvePstdioHome({ env: {}, homedir: () => "/home/user" })).toBe("/home/user/.pstdio");
  });
});

describe("installExtensionSource", () => {
  test("copies a local extension into PSTDIO_HOME using .gitignore while preserving git metadata", async () => {
    const source = join(root, "source-extension");
    makeExtension(source);
    writeFileSync(join(source, ".gitignore"), "node_modules/\ndist/\n");
    mkdirSync(join(source, "node_modules", "dep"), { recursive: true });
    mkdirSync(join(source, ".git"), { recursive: true });
    mkdirSync(join(source, "dist"), { recursive: true });
    writeFileSync(join(source, "node_modules", "dep", "index.js"), "");
    writeFileSync(join(source, ".git", "HEAD"), "");
    writeFileSync(join(source, "dist", "bundle.js"), "");

    const result = await installExtensionSource({
      source,
      skipInstall: true,
      env: { PSTDIO_HOME: pstdioHome },
      homedir: () => "/unused",
    });

    expect(result.installName).toBe("source-extension");
    expect(result.metadata).toMatchObject({
      id: "test.extension",
      namespace: "test",
      name: "Test Extension",
      version: "1.2.3",
    });
    expect(existsSync(join(pstdioHome, "extensions", "source-extension", "extension.ts"))).toBe(true);
    expect(existsSync(join(pstdioHome, "extensions", "source-extension", ".git", "HEAD"))).toBe(true);
    expect(existsSync(join(pstdioHome, "extensions", "source-extension", "node_modules"))).toBe(false);
    expect(existsSync(join(pstdioHome, "extensions", "source-extension", "dist"))).toBe(false);
    expect(result.check.errorCount).toBe(0);
  });

  test("does not skip generated folders unless the extension ignores them", async () => {
    const source = join(root, "source-extension");
    makeExtension(source);
    mkdirSync(join(source, "dist"), { recursive: true });
    writeFileSync(join(source, "dist", "bundle.js"), "");

    await installExtensionSource({
      source,
      skipInstall: true,
      env: { PSTDIO_HOME: pstdioHome },
      homedir: () => "/unused",
    });

    expect(existsSync(join(pstdioHome, "extensions", "source-extension", "dist", "bundle.js"))).toBe(true);
  });

  test("throws ExtensionAlreadyInstalledError when the target exists without force or existsOk", async () => {
    const source = join(root, "source-extension");
    makeExtension(source);
    const target = join(pstdioHome, "extensions", "source-extension");
    mkdirSync(target, { recursive: true });
    writeFileSync(
      join(target, "extension.ts"),
      "export default { id: 'test.extension', namespace: 'test', name: 'Test', apiVersion: '1' };",
    );

    await expect(
      installExtensionSource({
        source,
        skipInstall: true,
        env: { PSTDIO_HOME: pstdioHome },
        homedir: () => "/unused",
      }),
    ).rejects.toBeInstanceOf(ExtensionAlreadyInstalledError);
  });

  test("force=true replaces an existing install", async () => {
    const source = join(root, "source-extension");
    makeExtension(source);
    const target = join(pstdioHome, "extensions", "source-extension");
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, "custom.txt"), "keep");

    const result = await installExtensionSource({
      source,
      force: true,
      skipInstall: true,
      env: { PSTDIO_HOME: pstdioHome },
      homedir: () => "/unused",
    });

    expect(result.targetPath).toBe(target);
    expect(existsSync(join(target, "custom.txt"))).toBe(false);
  });

  test("existsOk=true reuses an existing install without re-copying", async () => {
    const source = join(root, "source-extension");
    makeExtension(source);

    await installExtensionSource({
      source,
      skipInstall: true,
      env: { PSTDIO_HOME: pstdioHome },
      homedir: () => "/unused",
    });

    const target = join(pstdioHome, "extensions", "source-extension");
    writeFileSync(join(target, "user-edit.txt"), "preserve");

    const result = await installExtensionSource({
      source,
      existsOk: true,
      skipInstall: true,
      env: { PSTDIO_HOME: pstdioHome },
      homedir: () => "/unused",
    });

    expect(result.targetPath).toBe(target);
    expect(readFileSync(join(target, "user-edit.txt"), "utf8")).toBe("preserve");
  });

  test("preserves copied source when dependency install fails", async () => {
    const source = join(root, "source-extension");
    makeExtension(source);
    writeFileSync(join(source, "package.json"), JSON.stringify({ packageManager: "bun@1.3.13" }));
    const runCommand = mock(async () => ({ exitCode: 1, stderr: "registry unavailable", stdout: "" }));

    await expect(
      installExtensionSource({
        source,
        env: { PSTDIO_HOME: pstdioHome },
        homedir: () => "/unused",
        isCommandAvailable: async () => true,
        runCommand,
      }),
    ).rejects.toThrow("Dependency install failed");

    expect(existsSync(join(pstdioHome, "extensions", "source-extension", "extension.ts"))).toBe(true);
    expect(runCommand).toHaveBeenCalledWith("bun", ["install"], {
      cwd: join(pstdioHome, "extensions", "source-extension"),
    });
  });

  test("falls back from the declared package manager to an available one", async () => {
    const source = join(root, "source-extension");
    makeExtension(source);
    writeFileSync(join(source, "package.json"), JSON.stringify({ packageManager: "yarn@4.0.0" }));
    const runCommand = mock(async () => ({ exitCode: 0, stderr: "", stdout: "" }));

    await installExtensionSource({
      source,
      env: { PSTDIO_HOME: pstdioHome },
      homedir: () => "/unused",
      isCommandAvailable: async (command) => command === "bun",
      runCommand,
    });

    expect(runCommand).toHaveBeenCalledWith("bun", ["install"], {
      cwd: join(pstdioHome, "extensions", "source-extension"),
    });
  });

  test("uses the compiled pstdio binary as Bun in packaged runtime", async () => {
    const source = join(root, "source-extension");
    makeExtension(source);
    writeFileSync(join(source, "package.json"), JSON.stringify({ packageManager: "bun@1.3.13" }));
    const runCommand = mock(async () => ({ exitCode: 0, stderr: "", stdout: "" }));

    await installExtensionSource({
      source,
      env: { PSTDIO_HOME: pstdioHome },
      homedir: () => "/unused",
      isCommandAvailable: async () => false,
      isPackagedRuntime: () => true,
      processExecPath: "/Applications/Prompt Studio.app/pstdio",
      runCommand,
    });

    expect(runCommand).toHaveBeenCalledWith("/Applications/Prompt Studio.app/pstdio", ["install"], {
      cwd: join(pstdioHome, "extensions", "source-extension"),
      env: expect.objectContaining({
        BUN_BE_BUN: "1",
        BUN_INSTALL_CACHE_DIR: join(pstdioHome, "cache", "extension-bun-install"),
      }),
    });
  });

  test("installs a named extension through the same code path", async () => {
    const namedSource = join(root, "named-source");
    makeExtension(namedSource, { id: "pstdio.planner", namespace: "planner", name: "Planner" });

    const result = await installExtensionSource({
      source: "planner",
      installName: "planner-dev",
      skipInstall: true,
      env: { PSTDIO_HOME: pstdioHome },
      homedir: () => "/unused",
      prepareNamedSource: async () => ({
        path: namedSource,
        ref: "https://github.com/pufflyai/prompt-studio#main:extensions/planner",
      }),
    });

    expect(result.installName).toBe("planner-dev");
    expect(result.source.kind).toBe("named");
    expect(result.metadata.namespace).toBe("planner");
    expect(existsSync(join(pstdioHome, "extensions", "planner-dev", "extension.ts"))).toBe(true);
  });

  test("refuses to copy an extension into itself", async () => {
    const source = join(pstdioHome, "extensions", "self-copy");
    makeExtension(source);

    await expect(
      installExtensionSource({
        source,
        force: true,
        skipInstall: true,
        env: { PSTDIO_HOME: pstdioHome },
        homedir: () => "/unused",
      }),
    ).rejects.toThrow("Refusing to copy an extension into itself");

    expect(readFileSync(join(source, "extension.ts"), "utf8")).toContain("test.extension");
  });
});
