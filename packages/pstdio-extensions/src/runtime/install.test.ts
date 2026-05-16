import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ExtensionInstallError, installExtensionSource } from "./install";

const tempDirs: string[] = [];

const createTempDir = (prefix: string) => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs.length = 0;
});

const VALID_EXTENSION_SRC = `export default {
  commands: {
    "say-hi": { title: "Say hi", cli: true, run: async () => undefined },
  },
};`;

const baseManifest = (fields: Record<string, unknown> = {}) => ({
  name: "my-extension",
  version: "0.1.0",
  displayName: "My Extension",
  publisher: "acme",
  main: "./extension.ts",
  engines: { pstdio: "^1.0.0" },
  ...fields,
});

const writeFolderExtension = (root: string, name: string, source: string) => {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify(baseManifest(), null, 2));
  writeFileSync(join(dir, "extension.ts"), source);
  return dir;
};

const createExtensionsRoot = () => {
  const home = createTempDir("pstdio-install-home-");
  const extensionsRoot = join(home, "extensions");
  return { home, extensionsRoot };
};

describe("installExtensionSource (local folder)", () => {
  test("copies a local folder to the extensions root and validates its export", async () => {
    const sourceParent = createTempDir("pstdio-install-src-");
    const sourceDir = writeFolderExtension(sourceParent, "my-extension-folder", VALID_EXTENSION_SRC);
    const { extensionsRoot } = createExtensionsRoot();

    const result = await installExtensionSource({ source: sourceDir, extensionsRoot, skipInstall: true });

    expect(result.installName).toBe("my-extension-folder");
    expect(result.installPath).toBe(join(extensionsRoot, "my-extension-folder"));
    expect(result.sourceKind).toBe("local");
    expect(result.errorCount).toBe(0);
    expect(result.extension?.id).toBe("acme.my-extension");
    expect(result.extension?.name).toBe("my-extension");
    expect(result.extension?.displayName).toBe("My Extension");
    expect(result.extension?.version).toBe("0.1.0");
    expect(existsSync(join(result.installPath, "extension.ts"))).toBe(true);
  });

  test("--name overrides the install folder name", async () => {
    const sourceParent = createTempDir("pstdio-install-src-");
    const sourceDir = writeFolderExtension(sourceParent, "my-extension-folder", VALID_EXTENSION_SRC);
    const { extensionsRoot } = createExtensionsRoot();

    const result = await installExtensionSource({
      source: sourceDir,
      installName: "my-custom-extension",
      extensionsRoot,
      skipInstall: true,
    });

    expect(result.installName).toBe("my-custom-extension");
    expect(result.installPath).toBe(join(extensionsRoot, "my-custom-extension"));
    expect(existsSync(result.installPath)).toBe(true);
  });

  test("preserves packaged dist assets and ignores dependency/cache folders during copy", async () => {
    const sourceParent = createTempDir("pstdio-install-src-");
    const sourceDir = writeFolderExtension(sourceParent, "with-junk", VALID_EXTENSION_SRC);

    for (const junk of ["node_modules", ".git", ".turbo", ".next"]) {
      const junkDir = join(sourceDir, junk);
      mkdirSync(junkDir, { recursive: true });
      writeFileSync(join(junkDir, "junk.txt"), "junk");
    }
    mkdirSync(join(sourceDir, "dist"), { recursive: true });
    writeFileSync(join(sourceDir, "dist", "lab-page.html"), "<html></html>");
    writeFileSync(join(sourceDir, "keep.txt"), "keep");

    const { extensionsRoot } = createExtensionsRoot();
    const result = await installExtensionSource({ source: sourceDir, extensionsRoot, skipInstall: true });

    expect(existsSync(join(result.installPath, "extension.ts"))).toBe(true);
    expect(existsSync(join(result.installPath, "keep.txt"))).toBe(true);
    expect(existsSync(join(result.installPath, "dist", "lab-page.html"))).toBe(true);
    for (const junk of ["node_modules", ".git", ".turbo", ".next"]) {
      expect(existsSync(join(result.installPath, junk))).toBe(false);
    }
  });

  test("fails when the source folder does not exist", async () => {
    const { extensionsRoot } = createExtensionsRoot();

    await expect(
      installExtensionSource({ source: "./does-not-exist-here-i-promise", extensionsRoot }),
    ).rejects.toMatchObject({ code: "source_not_found" });
  });

  test("fails when extension.ts is missing from the source folder", async () => {
    const sourceParent = createTempDir("pstdio-install-src-");
    const sourceDir = join(sourceParent, "missing-entry");
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(join(sourceDir, "README.md"), "# nope");

    const { extensionsRoot } = createExtensionsRoot();
    await expect(installExtensionSource({ source: sourceDir, extensionsRoot })).rejects.toMatchObject({
      code: "missing_package_manifest",
    });
  });

  test("preserves copied source and reports diagnostics when the default export is invalid", async () => {
    const sourceParent = createTempDir("pstdio-install-src-");
    const sourceDir = writeFolderExtension(sourceParent, "broken", `export default "nope";`);
    const { extensionsRoot } = createExtensionsRoot();

    const result = await installExtensionSource({ source: sourceDir, extensionsRoot, skipInstall: true });

    expect(result.errorCount).toBe(1);
    expect(result.runtime.diagnostics.map((diagnostic) => diagnostic.code)).toContain("invalid_default_export");
    expect(existsSync(join(extensionsRoot, "broken", "extension.ts"))).toBe(true);
  });

  test("fails when an install already exists and --force is not set", async () => {
    const sourceParent = createTempDir("pstdio-install-src-");
    const sourceDir = writeFolderExtension(sourceParent, "planner", VALID_EXTENSION_SRC);
    const { extensionsRoot } = createExtensionsRoot();

    await installExtensionSource({ source: sourceDir, extensionsRoot, skipInstall: true });

    await expect(
      installExtensionSource({ source: sourceDir, extensionsRoot, skipInstall: true }),
    ).rejects.toMatchObject({
      code: "already_installed",
    });
  });

  test("--force replaces an existing install", async () => {
    const sourceParent = createTempDir("pstdio-install-src-");
    const firstSource = writeFolderExtension(sourceParent, "planner", VALID_EXTENSION_SRC);
    const { extensionsRoot } = createExtensionsRoot();
    const first = await installExtensionSource({ source: firstSource, extensionsRoot, skipInstall: true });
    writeFileSync(join(first.installPath, "leftover.txt"), "leftover");
    expect(existsSync(join(first.installPath, "leftover.txt"))).toBe(true);

    const secondSource = writeFolderExtension(createTempDir("pstdio-install-src2-"), "planner", VALID_EXTENSION_SRC);
    writeManifest(secondSource, { displayName: "My Extension v2" });
    const second = await installExtensionSource({
      source: secondSource,
      extensionsRoot,
      force: true,
      skipInstall: true,
    });

    expect(existsSync(second.installPath)).toBe(true);
    expect(existsSync(join(second.installPath, "leftover.txt"))).toBe(false);
    expect(readFileSync(join(second.installPath, "package.json"), "utf8")).toContain("My Extension v2");
  });

  test("refuses to copy a folder into itself", async () => {
    const { extensionsRoot } = createExtensionsRoot();
    mkdirSync(extensionsRoot, { recursive: true });
    const selfInstallSource = writeFolderExtension(extensionsRoot, "selfie", VALID_EXTENSION_SRC);

    await expect(
      installExtensionSource({
        source: selfInstallSource,
        installName: "selfie",
        extensionsRoot,
        force: true,
        skipInstall: true,
      }),
    ).rejects.toMatchObject({ code: "invalid_target" });
  });
});

describe("installExtensionSource (named github source)", () => {
  test("uses the injected fetcher to materialize a source folder", async () => {
    const sourceParent = createTempDir("pstdio-install-src-");
    const sourceDir = writeFolderExtension(sourceParent, "planner", VALID_EXTENSION_SRC);
    const { extensionsRoot } = createExtensionsRoot();

    const cleanupCalls: number[] = [];
    const fetchGithubExtension = async () => ({
      kind: "github" as const,
      rootPath: sourceDir,
      defaultInstallName: "planner",
      cleanup: () => {
        cleanupCalls.push(Date.now());
      },
    });

    const result = await installExtensionSource(
      { source: "planner", extensionsRoot, skipInstall: true },
      { fetchGithubExtension },
    );

    expect(result.installName).toBe("planner");
    expect(result.installPath).toBe(join(extensionsRoot, "planner"));
    expect(result.sourceKind).toBe("github");
    expect(result.extension?.id).toBe("acme.my-extension");
    expect(cleanupCalls).toHaveLength(1);
  });

  test("propagates fetcher errors", async () => {
    const { extensionsRoot } = createExtensionsRoot();

    const fetchGithubExtension = async () => {
      throw new ExtensionInstallError("extension_not_in_repo", "boom");
    };

    await expect(
      installExtensionSource({ source: "missing", extensionsRoot }, { fetchGithubExtension }),
    ).rejects.toMatchObject({ code: "extension_not_in_repo" });
  });
});

describe("installExtensionSource integration with checkExtensions", () => {
  test("an installed extension shows up in a subsequent extensions check", async () => {
    const sourceParent = createTempDir("pstdio-install-src-");
    const sourceDir = writeFolderExtension(sourceParent, "planner", VALID_EXTENSION_SRC);
    const { home, extensionsRoot } = createExtensionsRoot();

    const result = await installExtensionSource({ source: sourceDir, extensionsRoot, skipInstall: true });
    expect(readFileSync(join(result.installPath, "package.json"), "utf8")).toContain("acme");

    const { checkExtensions } = await import("./check");
    const check = await checkExtensions({ homeRoot: home, includeUserRoot: false });

    expect(check.extensionsRootExists).toBe(true);
    expect(check.runtime.extensions.map((ext) => ext.id)).toContain("acme.my-extension");
    expect(check.errorCount).toBe(0);
  });
});

const writeManifest = (dir: string, manifest: Record<string, unknown>) => {
  writeFileSync(join(dir, "package.json"), JSON.stringify(baseManifest(manifest)));
};

const writeFakeManagerBinary = (
  binDir: string,
  name: "npm" | "bun",
  options: { exitCode?: number; record?: string } = {},
) => {
  mkdirSync(binDir, { recursive: true });
  const exitCode = options.exitCode ?? 0;
  const recordLine = options.record ? `printf "%s %s\\n" "${name}" "$1" >> ${JSON.stringify(options.record)}\n` : "";
  const script =
    `#!/bin/sh\n` +
    `if [ "$1" = "--version" ]; then echo "${name} fake"; exit 0; fi\n` +
    recordLine +
    `exit ${exitCode}\n`;
  const path = join(binDir, name);
  writeFileSync(path, script);
  chmodSync(path, 0o755);
  return path;
};

const withPath = async (path: string, fn: () => Promise<void>) => {
  const original = process.env.PATH;
  process.env.PATH = path;
  try {
    await fn();
  } finally {
    process.env.PATH = original;
  }
};

describe("installExtensionSource (dependency installation)", () => {
  let originalPath: string | undefined;

  beforeEach(() => {
    originalPath = process.env.PATH;
  });

  afterEach(() => {
    process.env.PATH = originalPath;
  });

  test("fails before dep install when package.json is missing", async () => {
    const sourceParent = createTempDir("pstdio-install-src-");
    const sourceDir = writeFolderExtension(sourceParent, "planner", VALID_EXTENSION_SRC);
    rmSync(join(sourceDir, "package.json"));
    const { extensionsRoot } = createExtensionsRoot();

    await expect(installExtensionSource({ source: sourceDir, extensionsRoot })).rejects.toMatchObject({
      code: "missing_package_manifest",
    });
  });

  test("skips dep install when skipInstall is set", async () => {
    const sourceParent = createTempDir("pstdio-install-src-");
    const sourceDir = writeFolderExtension(sourceParent, "planner", VALID_EXTENSION_SRC);
    writeManifest(sourceDir, { name: "planner", dependencies: {} });
    const { extensionsRoot } = createExtensionsRoot();

    const result = await installExtensionSource({ source: sourceDir, extensionsRoot, skipInstall: true });

    expect(result.dependencyInstall).toEqual({ ran: false, reason: "skipped" });
  });

  test("invokes the detected manager when package.json + lockfile exist", async () => {
    const sourceParent = createTempDir("pstdio-install-src-");
    const sourceDir = writeFolderExtension(sourceParent, "planner", VALID_EXTENSION_SRC);
    writeManifest(sourceDir, { name: "planner" });
    writeFileSync(join(sourceDir, "package-lock.json"), "{}");

    const binDir = createTempDir("pstdio-install-bin-");
    const recordPath = join(binDir, "calls.log");
    writeFakeManagerBinary(binDir, "npm", { record: recordPath });
    const { extensionsRoot } = createExtensionsRoot();

    await withPath(`${binDir}:/usr/bin:/bin`, async () => {
      const result = await installExtensionSource({ source: sourceDir, extensionsRoot });
      expect(result.dependencyInstall).toMatchObject({
        ran: true,
        manager: "npm",
        command: "npm install --no-audit --no-fund",
      });
      expect(readFileSync(recordPath, "utf8")).toContain("npm install");
    });
  });

  test("--package-manager override is honored", async () => {
    const sourceParent = createTempDir("pstdio-install-src-");
    const sourceDir = writeFolderExtension(sourceParent, "planner", VALID_EXTENSION_SRC);
    writeManifest(sourceDir, { name: "planner" });
    writeFileSync(join(sourceDir, "package-lock.json"), "{}");

    const binDir = createTempDir("pstdio-install-bin-");
    const recordPath = join(binDir, "calls.log");
    writeFakeManagerBinary(binDir, "bun", { record: recordPath });
    const { extensionsRoot } = createExtensionsRoot();

    await withPath(`${binDir}:/usr/bin:/bin`, async () => {
      const result = await installExtensionSource({ source: sourceDir, extensionsRoot, packageManager: "bun" });
      expect(result.dependencyInstall).toMatchObject({ ran: true, manager: "bun", command: "bun install" });
      expect(readFileSync(recordPath, "utf8")).toContain("bun install");
    });
  });

  test("throws package_manager_not_found when forced manager is missing", async () => {
    const sourceParent = createTempDir("pstdio-install-src-");
    const sourceDir = writeFolderExtension(sourceParent, "planner", VALID_EXTENSION_SRC);
    writeManifest(sourceDir, { name: "planner" });
    const binDir = createTempDir("pstdio-install-bin-");
    const { extensionsRoot } = createExtensionsRoot();

    await withPath(binDir, async () => {
      await expect(
        installExtensionSource({ source: sourceDir, extensionsRoot, packageManager: "bun" }),
      ).rejects.toMatchObject({ code: "package_manager_not_found" });
    });
  });

  test("keeps copied source on dep install failure and exits with typed error", async () => {
    const sourceParent = createTempDir("pstdio-install-src-");
    const sourceDir = writeFolderExtension(sourceParent, "planner", VALID_EXTENSION_SRC);
    writeManifest(sourceDir, { name: "planner" });
    writeFileSync(join(sourceDir, "package-lock.json"), "{}");

    const binDir = createTempDir("pstdio-install-bin-");
    writeFakeManagerBinary(binDir, "npm", { exitCode: 1 });
    const { extensionsRoot } = createExtensionsRoot();
    const expectedInstallPath = join(extensionsRoot, "planner");

    await withPath(`${binDir}:/usr/bin:/bin`, async () => {
      await expect(installExtensionSource({ source: sourceDir, extensionsRoot })).rejects.toMatchObject({
        code: "dependencies_install_failed",
      });
      expect(existsSync(expectedInstallPath)).toBe(true);
      expect(existsSync(join(expectedInstallPath, "extension.ts"))).toBe(true);
    });
  });

  test("widened ignore list excludes build, coverage, .cache during copy", async () => {
    const sourceParent = createTempDir("pstdio-install-src-");
    const sourceDir = writeFolderExtension(sourceParent, "with-extras", VALID_EXTENSION_SRC);
    for (const junk of ["build", "coverage", ".cache", ".vite"]) {
      mkdirSync(join(sourceDir, junk), { recursive: true });
      writeFileSync(join(sourceDir, junk, "x.txt"), "junk");
    }
    const { extensionsRoot } = createExtensionsRoot();

    const result = await installExtensionSource({ source: sourceDir, extensionsRoot, skipInstall: true });
    for (const junk of ["build", "coverage", ".cache", ".vite"]) {
      expect(existsSync(join(result.installPath, junk))).toBe(false);
    }
  });
});
