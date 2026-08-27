import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ExtensionAlreadyInstalledError,
  installExtensionSource,
  namedSourceRef,
  resolvePstdioHome,
} from "./install-extension-source";
import { makeExtension, writeManifest } from "./install-extension-source-test-fixtures";

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

describe("installExtensionSource scope", () => {
  test("copies a repo-scoped extension into the linked repo extension root", async () => {
    const source = join(root, "repo-extension");
    const repoPath = join(root, "repo");
    makeExtension(source, { pstdio: { scope: "repo" } });

    const result = await installExtensionSource({
      source,
      repoPath,
      skipInstall: true,
      env: { PSTDIO_HOME: pstdioHome },
      homedir: () => "/unused",
    });

    expect(result.targetPath).toBe(join(repoPath, ".pstdio", "extensions", "repo-extension"));
    expect(result.metadata.pstdio?.scope).toBe("repo");
    expect(existsSync(join(repoPath, ".pstdio", "extensions", "repo-extension", "extension.ts"))).toBe(true);
    expect(existsSync(join(pstdioHome, "extensions", "repo-extension", "extension.ts"))).toBe(false);
  });

  test("rejects repo-scoped installs without a linked repo path", async () => {
    const source = join(root, "repo-extension");
    makeExtension(source, { pstdio: { scope: "repo" } });

    await expect(
      installExtensionSource({
        source,
        skipInstall: true,
        env: { PSTDIO_HOME: pstdioHome },
        homedir: () => "/unused",
      }),
    ).rejects.toThrow('declares pstdio.scope "repo" and must be installed from a linked repo');

    expect(existsSync(join(pstdioHome, "extensions", "repo-extension", "extension.ts"))).toBe(false);
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
      id: "test.test",
      name: "test",
      displayName: "Test Extension",
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
    writeFileSync(join(target, "extension.ts"), "export default {};");

    await expect(
      installExtensionSource({
        source,
        skipInstall: true,
        env: { PSTDIO_HOME: pstdioHome },
        homedir: () => "/unused",
      }),
    ).rejects.toBeInstanceOf(ExtensionAlreadyInstalledError);
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

  test("installs dependencies with bun regardless of any declared package manager", async () => {
    // Prompt Studio is bun-only: even an extension that declares another manager is installed with
    // bun (the workspace manager installs npm packages fine and reuses the warm bun cache).
    const source = join(root, "source-extension");
    makeExtension(source);
    writeManifest(source, { packageManager: "yarn@4.0.0" });
    const runCommand = mock(async () => ({ exitCode: 0, stderr: "", stdout: "" }));

    await installExtensionSource({
      source,
      env: {
        PATH: "/bin",
        HTTPS_PROXY: "https://proxy.example.com",
        NPM_CONFIG_REGISTRY: "https://registry.example.com",
        NODE_EXTRA_CA_CERTS: "/certs/company.pem",
        PSTDIO_API_TOKEN: "runtime-secret",
        PSTDIO_HOME: pstdioHome,
      },
      homedir: () => "/unused",
      runCommand,
    });

    expect(runCommand).toHaveBeenCalledWith("bun", ["install"], {
      cwd: expect.stringContaining(join(pstdioHome, ".extension-install-")),
      env: {
        PATH: "/bin",
        HTTPS_PROXY: "https://proxy.example.com",
        NPM_CONFIG_REGISTRY: "https://registry.example.com",
        NODE_EXTRA_CA_CERTS: "/certs/company.pem",
      },
    });
  });

  test("uses the compiled pstdio binary as Bun in packaged runtime", async () => {
    const source = join(root, "source-extension");
    makeExtension(source);
    writeManifest(source, { packageManager: "bun@1.3.13" });
    const runCommand = mock(async () => ({ exitCode: 0, stderr: "", stdout: "" }));

    await installExtensionSource({
      source,
      env: { PSTDIO_HOME: pstdioHome },
      homedir: () => "/unused",
      isPackagedRuntime: () => true,
      processExecPath: "/Applications/Prompt Studio.app/pstdio",
      runCommand,
    });

    expect(runCommand).toHaveBeenCalledWith("/Applications/Prompt Studio.app/pstdio", ["install"], {
      cwd: expect.stringContaining(join(pstdioHome, ".extension-install-")),
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
        ref: "https://github.com/pufflyai/prompt-studio@0f1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c#extensions/planner",
      }),
    });

    expect(result.installName).toBe("planner-dev");
    expect(result.source.kind).toBe("named");
    expect(result.metadata.name).toBe("planner");
    expect(existsSync(join(pstdioHome, "extensions", "planner-dev", "extension.ts"))).toBe(true);
  });

  test("records the commit the named source resolved to and passes the requested ref through", async () => {
    const namedSource = join(root, "named-source");
    makeExtension(namedSource, { id: "pstdio.planner", namespace: "planner", name: "Planner" });
    const requestedRefs: Array<string | undefined> = [];

    const result = await installExtensionSource({
      source: "planner",
      ref: "pstdio@0.26.2",
      skipInstall: true,
      env: { PSTDIO_HOME: pstdioHome },
      homedir: () => "/unused",
      prepareNamedSource: async (name, _tempDir, ref) => {
        requestedRefs.push(ref);
        return {
          path: namedSource,
          ref: namedSourceRef("0f1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c", name),
        };
      },
    });

    expect(requestedRefs).toEqual(["pstdio@0.26.2"]);
    // The pin is the commit, not the tag that was asked for: a tag can move, a commit cannot.
    expect(result.source).toMatchObject({
      kind: "named",
      name: "planner",
      ref: "https://github.com/pufflyai/prompt-studio@0f1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c#extensions/planner",
    });
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

    expect(readFileSync(join(source, "package.json"), "utf8")).toContain("test");
  });
});
