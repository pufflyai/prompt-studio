import { afterEach, describe, expect, mock, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Mock child_process to avoid real installs in tests
const execFileSyncMock = mock();
mock.module("node:child_process", () => ({ execFileSync: execFileSyncMock }));

const { ensurePluginWorkspace, detectRuntime } = await import("./workspace");

let tempDirs: string[] = [];

const createTempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-workspace-test-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
  execFileSyncMock.mockReset();
});

describe("ensurePluginWorkspace", () => {
  test("runs install after writing package.json", async () => {
    const dir = createTempDir();

    await ensurePluginWorkspace(dir);

    const installCall = execFileSyncMock.mock.calls.find(
      (call: unknown[]) => call[0] === "bun" && (call[1] as string[])?.[0] === "install",
    ) as unknown[] | undefined;
    expect(installCall).toBeDefined();
    expect((installCall![2] as { cwd: string }).cwd).toBe(dir);
  });

  test("does not throw when install fails", async () => {
    const dir = createTempDir();
    execFileSyncMock.mockImplementation((command: string, args: string[]) => {
      if (command === "bun" && args[0] === "--version") {
        return Buffer.from("1.0.0");
      }

      if (command === "bun" && args[0] === "install") {
        throw new Error("install failed");
      }

      return Buffer.from("");
    });

    await expect(ensurePluginWorkspace(dir)).resolves.toBeUndefined();

    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    expect(pkg.dependencies["@pstdio/sdk"]).toBe("latest");
  });

  test("skips when package.json already has @pstdio/sdk and node_modules exists", async () => {
    const dir = createTempDir();
    const existingPkg = {
      private: true,
      type: "module",
      dependencies: { "@pstdio/sdk": "0.1.0" },
    };
    writeFileSync(join(dir, "package.json"), JSON.stringify(existingPkg));
    mkdirSync(join(dir, "node_modules", "@pstdio", "sdk"), { recursive: true });

    await ensurePluginWorkspace(dir);

    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    expect(pkg.dependencies["@pstdio/sdk"]).toBe("0.1.0");
    expect(execFileSyncMock).not.toHaveBeenCalled();
  });

  test("re-installs when package.json has @pstdio/sdk but node_modules is missing", async () => {
    const dir = createTempDir();
    const existingPkg = {
      private: true,
      type: "module",
      dependencies: { "@pstdio/sdk": "0.1.0" },
    };
    writeFileSync(join(dir, "package.json"), JSON.stringify(existingPkg));

    await ensurePluginWorkspace(dir);

    const installCall = execFileSyncMock.mock.calls.find(
      (call: unknown[]) => call[0] === "bun" && (call[1] as string[])?.[0] === "install",
    ) as unknown[] | undefined;
    expect(installCall).toBeDefined();
  });
});

describe("detectRuntime", () => {
  test("returns bun when bun is available", () => {
    execFileSyncMock.mockImplementation(() => Buffer.from("1.0.0"));

    expect(detectRuntime()).toBe("bun");
  });

  test("returns npm when bun is not available", () => {
    execFileSyncMock.mockImplementation(() => {
      throw new Error("not found");
    });

    expect(detectRuntime()).toBe("npm");
  });
});
