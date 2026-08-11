import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createApp } from "../app";

const REPO_ROOT = resolve(import.meta.dir, "../../../..");

describe("startup default extensions", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-startup-default-extensions-"));
  const previousDefaultExtensions = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  const previousDisableEmbedManifest = process.env.PSTDIO_DISABLE_EMBED_MANIFEST;
  const previousPstdioHome = process.env.PSTDIO_HOME;

  const restoreEnv = () => {
    if (previousDefaultExtensions === undefined) {
      delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
    } else {
      process.env.PSTDIO_DEFAULT_EXTENSIONS = previousDefaultExtensions;
    }
    if (previousPstdioHome === undefined) {
      delete process.env.PSTDIO_HOME;
    } else {
      process.env.PSTDIO_HOME = previousPstdioHome;
    }
    if (previousDisableEmbedManifest === undefined) {
      delete process.env.PSTDIO_DISABLE_EMBED_MANIFEST;
    } else {
      process.env.PSTDIO_DISABLE_EMBED_MANIFEST = previousDisableEmbedManifest;
    }
  };

  afterEach(() => {
    restoreEnv();
  });

  afterAll(() => {
    restoreEnv();
    rmSync(tempRoot, { recursive: true, force: true });
  });

  test("installs configured default extensions during startup", async () => {
    const pstdioHome = join(tempRoot, "home-defaults");
    process.env.PSTDIO_HOME = pstdioHome;
    process.env.PSTDIO_DEFAULT_EXTENSIONS = JSON.stringify([
      { source: resolve(REPO_ROOT, "extensions/extension-lab"), installName: "extension-lab", skipInstall: true },
      {
        source: resolve(REPO_ROOT, "extensions/pstdio-base-themes"),
        installName: "pstdio-base-themes",
        skipInstall: true,
      },
    ]);

    const { close } = await createApp({
      dbPath: ":memory:",
      storagePath: join(tempRoot, "storage-defaults"),
      filesRoot: "",
    });

    await close();

    expect(existsSync(join(pstdioHome, "extensions/extension-lab"))).toBe(true);
    expect(existsSync(join(pstdioHome, "extensions/pstdio-base-themes"))).toBe(true);
  }, 40_000);

  test("refreshes local default extensions when running from source", async () => {
    const pstdioHome = join(tempRoot, "home-source-refresh");
    const source = resolve(REPO_ROOT, "extensions/extension-lab");
    const installed = join(pstdioHome, "extensions/extension-lab");
    cpSync(source, installed, { recursive: true });
    writeFileSync(join(installed, "README.md"), "stale extension lab");

    process.env.PSTDIO_HOME = pstdioHome;
    process.env.PSTDIO_DISABLE_EMBED_MANIFEST = "1";
    process.env.PSTDIO_DEFAULT_EXTENSIONS = JSON.stringify(["extension-lab"]);

    const { close } = await createApp({
      dbPath: ":memory:",
      storagePath: join(tempRoot, "storage-source-refresh"),
      filesRoot: "",
    });

    await close();

    expect(readFileSync(join(installed, "README.md"), "utf8")).toBe(readFileSync(join(source, "README.md"), "utf8"));
  }, 40_000);
});
