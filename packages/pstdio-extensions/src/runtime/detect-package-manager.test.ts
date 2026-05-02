import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectPackageManager } from "./detect-package-manager";

const tempDirs: string[] = [];

const createDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-detect-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs.length = 0;
});

const writeManifest = (dir: string, manifest: Record<string, unknown>) => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify(manifest));
};

describe("detectPackageManager", () => {
  test("honors packageManager: bun@... over lockfile signals", () => {
    const dir = createDir();
    writeManifest(dir, { packageManager: "bun@1.3.0" });
    writeFileSync(join(dir, "package-lock.json"), "{}");

    const result = detectPackageManager(dir);
    expect(result.manager).toBe("bun");
    expect(result.reason).toBe("package_manager_field");
  });

  test("honors packageManager: npm@... over lockfile signals", () => {
    const dir = createDir();
    writeManifest(dir, { packageManager: "npm@10.0.0" });
    writeFileSync(join(dir, "bun.lock"), "");

    const result = detectPackageManager(dir);
    expect(result.manager).toBe("npm");
    expect(result.reason).toBe("package_manager_field");
  });

  test("falls through to lockfile when packageManager value is unsupported", () => {
    const dir = createDir();
    writeManifest(dir, { packageManager: "pnpm@9.0.0" });
    writeFileSync(join(dir, "bun.lock"), "");

    const result = detectPackageManager(dir);
    expect(result.manager).toBe("bun");
    expect(result.reason).toBe("lockfile");
  });

  test("detects bun via bun.lock", () => {
    const dir = createDir();
    writeManifest(dir, {});
    writeFileSync(join(dir, "bun.lock"), "");

    const result = detectPackageManager(dir);
    expect(result.manager).toBe("bun");
    expect(result.reason).toBe("lockfile");
  });

  test("detects bun via bun.lockb", () => {
    const dir = createDir();
    writeManifest(dir, {});
    writeFileSync(join(dir, "bun.lockb"), "");

    const result = detectPackageManager(dir);
    expect(result.manager).toBe("bun");
    expect(result.reason).toBe("lockfile");
  });

  test("detects npm via package-lock.json", () => {
    const dir = createDir();
    writeManifest(dir, {});
    writeFileSync(join(dir, "package-lock.json"), "{}");

    const result = detectPackageManager(dir);
    expect(result.manager).toBe("npm");
    expect(result.reason).toBe("lockfile");
  });

  test("falls back to npm when no signals exist", () => {
    const dir = createDir();
    writeManifest(dir, {});

    const result = detectPackageManager(dir);
    expect(result.manager).toBe("npm");
    expect(result.reason).toBe("fallback_npm");
  });

  test("falls back to npm when package.json is missing", () => {
    const dir = createDir();
    const result = detectPackageManager(dir);
    expect(result.manager).toBe("npm");
    expect(result.reason).toBe("fallback_npm");
  });

  test("falls back to npm when package.json is malformed", () => {
    const dir = createDir();
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "package.json"), "{ not valid json");

    const result = detectPackageManager(dir);
    expect(result.manager).toBe("npm");
    expect(result.reason).toBe("fallback_npm");
  });

  test("bun.lock wins over package-lock.json when both exist", () => {
    const dir = createDir();
    writeManifest(dir, {});
    writeFileSync(join(dir, "bun.lock"), "");
    writeFileSync(join(dir, "package-lock.json"), "{}");

    const result = detectPackageManager(dir);
    expect(result.manager).toBe("bun");
  });
});
