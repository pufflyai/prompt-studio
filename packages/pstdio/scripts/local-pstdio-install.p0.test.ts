import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installLocalPstdio, removeLocalPstdio, resolveLocalPstdioInstallDir } from "./local-pstdio-install";

const posixOnlyTest = process.platform === "win32" ? test.skip : test;

describe("installLocalPstdio", () => {
  posixOnlyTest("installs a dev-server wrapper that runs the local CLI with dev server env", () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-local-install-"));
    try {
      const installDir = join(root, "bin");
      const fakeBinDir = join(root, "fake-bin");
      const outputPath = join(root, "fake-bun-output.txt");
      mkdirSync(fakeBinDir);

      const fakeBunPath = join(fakeBinDir, "bun");
      writeFileSync(
        fakeBunPath,
        [
          "#!/bin/sh",
          "{",
          "printf 'PSTDIO_HOME=%s\\n' \"$PSTDIO_HOME\"",
          "printf 'PSTDIO_API_URL=%s\\n' \"$PSTDIO_API_URL\"",
          "printf 'PSTDIO_DISABLE_API_AUTO_START=%s\\n' \"$PSTDIO_DISABLE_API_AUTO_START\"",
          "printf 'PSTDIO_DISABLE_EMBED_MANIFEST=%s\\n' \"$PSTDIO_DISABLE_EMBED_MANIFEST\"",
          "printf 'argv=%s\\n' \"$*\"",
          `} > "${outputPath}"`,
        ].join("\n"),
      );
      chmodSync(fakeBunPath, 0o755);

      const { destination } = installLocalPstdio({
        installDir,
        repoRoot: root,
        mode: { type: "dev-server", apiUrl: "http://127.0.0.1:4173" },
        pathEnv: installDir,
      });

      const { PSTDIO_HOME: _pstdioHome, ...env } = process.env;
      const result = spawnSync(destination, ["tickets", "list"], {
        env: { ...env, PATH: `${fakeBinDir}:${process.env.PATH ?? ""}` },
        encoding: "utf8",
      });

      expect(result.status).toBe(0);
      const lines = readFileSync(outputPath, "utf8").split("\n");

      expect(lines.find((line) => line.startsWith("PSTDIO_HOME="))).toEndWith("/.pstdio-dev");
      expect(lines).toEqual(
        expect.arrayContaining([
          "PSTDIO_API_URL=http://127.0.0.1:4173",
          "PSTDIO_DISABLE_API_AUTO_START=1",
          "PSTDIO_DISABLE_EMBED_MANIFEST=1",
          `argv=--conditions=source ${join(root, "packages/pstdio/src/index.ts")} tickets list`,
        ]),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("writes a cmd wrapper on Windows", () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-local-install-"));
    try {
      const installDir = join(root, "bin");
      const result = installLocalPstdio({
        installDir,
        pathEnv: installDir,
        platform: "win32",
        repoRoot: "C:\\repo",
      });

      const wrapper = readFileSync(result.destination, "utf8");
      expect(result.destination).toBe(join(installDir, "pstdio.cmd"));
      expect(existsSync(join(installDir, "pst.cmd"))).toBe(true);
      expect(wrapper).toContain("@echo off");
      expect(wrapper).toContain("REM managed-by=pstdio-local-checkout");
      expect(wrapper).toContain('bun --conditions=source "');
      expect(wrapper).toContain("%*");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("removes an old managed extensionless wrapper on Windows", () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-local-install-"));
    try {
      const installDir = join(root, "bin");
      mkdirSync(installDir, { recursive: true });
      const legacyWrapper = join(installDir, "pstdio");
      writeFileSync(legacyWrapper, "#!/bin/sh\n# managed-by=pstdio-local-checkout\n# repo-root=C:\\repo\n");

      installLocalPstdio({
        installDir,
        pathEnv: installDir,
        platform: "win32",
        repoRoot: "C:\\repo",
      });

      expect(existsSync(legacyWrapper)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("uses the Windows path delimiter when checking PATH", () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-local-install-"));
    try {
      const installDir = join(root, "bin");
      const result = installLocalPstdio({
        installDir,
        pathEnv: `${join(root, "other")};${installDir}`,
        platform: "win32",
        repoRoot: "C:\\repo",
      });

      expect(result.needsPathUpdate).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("installs beside Bun when its Windows bin directory is on PATH", () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-local-install-"));
    try {
      const bunBinDir = join(root, "bun-bin");
      mkdirSync(bunBinDir);
      writeFileSync(join(bunBinDir, "bun.exe"), "");

      expect(resolveLocalPstdioInstallDir(bunBinDir, "win32")).toBe(bunBinDir);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("removes both Windows command wrappers", () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-local-install-"));
    try {
      const installDir = join(root, "bin");
      installLocalPstdio({ installDir, platform: "win32", repoRoot: "C:\\repo" });

      removeLocalPstdio({ installDir, platform: "win32", repoRoot: "C:\\repo" });

      expect(existsSync(join(installDir, "pstdio.cmd"))).toBe(false);
      expect(existsSync(join(installDir, "pst.cmd"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
