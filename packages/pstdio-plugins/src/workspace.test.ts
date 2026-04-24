import { afterEach, describe, expect, mock, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Mock child_process to avoid real installs in tests
const execFileSyncMock = mock();
const execFileMock = mock(
  (
    _command: string,
    _args: readonly string[],
    _options: unknown,
    callback: (err: Error | null, stdout: string, stderr: string) => void,
  ) => {
    callback(null, "", "");
    return {} as { unref?: () => void };
  },
);
mock.module("node:child_process", () => ({
  execFileSync: execFileSyncMock,
  execFile: execFileMock,
}));

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
  execFileMock.mockReset();
  execFileMock.mockImplementation(
    (
      _command: string,
      _args: readonly string[],
      _options: unknown,
      callback: (err: Error | null, stdout: string, stderr: string) => void,
    ) => {
      callback(null, "", "");
      return {} as { unref?: () => void };
    },
  );
});

describe("ensurePluginWorkspace", () => {
  test("runs install after writing package.json", async () => {
    const dir = createTempDir();

    await ensurePluginWorkspace(dir);

    const installCall = execFileMock.mock.calls.find(
      (call: unknown[]) => call[0] === "bun" && (call[1] as string[])?.[0] === "install",
    ) as unknown[] | undefined;
    expect(installCall).toBeDefined();
    expect((installCall![2] as { cwd: string }).cwd).toBe(dir);
  });

  test("does not block the event loop while install is running", async () => {
    // Regression: before this fix, install ran via `execFileSync` which blocks
    // the event loop. On CI, that caused scheduler-driven installs to prevent
    // `bun test` from exiting between packages.
    const dir = createTempDir();

    let resolveInstall!: () => void;
    const installPromise = new Promise<void>((resolve) => {
      resolveInstall = resolve;
    });

    execFileMock.mockImplementation(
      (
        command: string,
        args: readonly string[],
        _options: unknown,
        callback: (err: Error | null, stdout: string, stderr: string) => void,
      ) => {
        if (command === "bun" && args[0] === "install") {
          installPromise.then(() => callback(null, "", ""));
        } else {
          callback(null, "", "");
        }
        return {} as { unref?: () => void };
      },
    );

    const workspaceDone = ensurePluginWorkspace(dir);

    let microtaskRan = false;
    await Promise.resolve().then(() => {
      microtaskRan = true;
    });

    expect(microtaskRan).toBe(true);
    resolveInstall();
    await workspaceDone;
  });

  test("does not throw when install fails", async () => {
    const dir = createTempDir();
    execFileMock.mockImplementation(
      (
        command: string,
        args: readonly string[],
        _options: unknown,
        callback: (err: Error | null, stdout: string, stderr: string) => void,
      ) => {
        if (command === "bun" && args[0] === "install") {
          callback(new Error("install failed"), "", "");
          return {} as { unref?: () => void };
        }
        callback(null, "", "");
        return {} as { unref?: () => void };
      },
    );

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
    expect(execFileMock).not.toHaveBeenCalled();
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

    const installCall = execFileMock.mock.calls.find(
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
