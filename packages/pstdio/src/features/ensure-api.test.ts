import { afterEach, describe, expect, it } from "bun:test";
import { appendFileSync, rmSync } from "node:fs";
import { type EnsureApiDeps, ensureApi } from "./ensure-api";

const originalDisableAutoStart = process.env.PSTDIO_DISABLE_API_AUTO_START;
const originalLogPath = process.env.PSTDIO_LOG_PATH;
const originalDbPath = process.env.PSTDIO_DB_PATH;
const logPath = "/tmp/pstdio-test-logs.jsonl";

const healthyDeps = (spies = { runApiCalled: false }): EnsureApiDeps => ({
  isHealthy: async () => true,
  waitForHealthy: async () => {},
  runApi: () => {
    spies.runApiCalled = true;
    return null;
  },
});

// Writes a correlated child error while the health check is pending, then times out.
const loggingDeps = (output: string): EnsureApiDeps => {
  let autostartId: string | undefined;

  return {
    isHealthy: async () => false,
    waitForHealthy: async () => {
      appendFileSync(logPath, `${JSON.stringify({ autostartId, level: 50, message: output })}\n`);
      throw new Error("Service at http://localhost:3000/healthz did not become healthy within 15000ms");
    },
    runApi: (_cwd, options) => {
      autostartId = options?.env?.PSTDIO_AUTOSTART_ID;
      return { apiRoot: "/fake", child: {} };
    },
  };
};

const unhealthyThenHealthyDeps = (spies = { runApiCalled: false }): EnsureApiDeps => ({
  isHealthy: async () => false,
  waitForHealthy: async () => {},
  runApi: () => {
    spies.runApiCalled = true;
    return { apiRoot: "/fake", child: {} };
  },
});

describe("ensureApi", () => {
  afterEach(() => {
    rmSync(logPath, { force: true });

    if (originalDisableAutoStart === undefined) {
      delete process.env.PSTDIO_DISABLE_API_AUTO_START;
    } else {
      process.env.PSTDIO_DISABLE_API_AUTO_START = originalDisableAutoStart;
    }

    if (originalLogPath === undefined) {
      delete process.env.PSTDIO_LOG_PATH;
    } else {
      process.env.PSTDIO_LOG_PATH = originalLogPath;
    }

    if (originalDbPath === undefined) {
      delete process.env.PSTDIO_DB_PATH;
    } else {
      process.env.PSTDIO_DB_PATH = originalDbPath;
    }
  });

  it("does nothing when api is already healthy", async () => {
    const spies = { runApiCalled: false };
    await ensureApi("http://localhost:3000", healthyDeps(spies));
    expect(spies.runApiCalled).toBe(false);
  });

  it("starts api when not healthy", async () => {
    const spies = { runApiCalled: false };
    let stdio: string | undefined;
    let autostartId: string | undefined;
    const deps = unhealthyThenHealthyDeps(spies);
    deps.runApi = (_cwd, options) => {
      spies.runApiCalled = true;
      stdio = options?.stdio;
      autostartId = options?.env?.PSTDIO_AUTOSTART_ID;
      return { apiRoot: "/fake", child: {} };
    };

    await ensureApi("http://localhost:3000", deps);
    expect(spies.runApiCalled).toBe(true);
    expect(stdio).toBe("ignore");
    expect(autostartId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("waits for api to become healthy after starting", async () => {
    let waitUrl = "";
    const deps: EnsureApiDeps = {
      isHealthy: async () => false,
      waitForHealthy: async (opts) => {
        waitUrl = opts.url;
      },
      runApi: () => ({ apiRoot: "/fake", child: {} }),
    };

    await ensureApi("http://localhost:4000", deps);
    expect(waitUrl).toBe("http://localhost:4000/healthz");
  });

  it("throws when api fails to start and runApi returns null", async () => {
    process.env.PSTDIO_LOG_PATH = logPath;
    const deps: EnsureApiDeps = {
      isHealthy: async () => false,
      waitForHealthy: async () => {},
      runApi: () => null,
    };

    await expect(ensureApi("http://localhost:3000", deps)).rejects.toThrow("API process could not be launched");
    await expect(ensureApi("http://localhost:3000", deps)).rejects.toThrow(logPath);
  });

  it("explains when auto-start is disabled", async () => {
    process.env.PSTDIO_DISABLE_API_AUTO_START = "1";
    process.env.PSTDIO_LOG_PATH = logPath;
    const deps: EnsureApiDeps = {
      isHealthy: async () => false,
      waitForHealthy: async () => {},
      runApi: () => {
        throw new Error("runApi should not be called");
      },
    };

    await expect(ensureApi("http://localhost:3000", deps)).rejects.toThrow("API auto-start is disabled");
    await expect(ensureApi("http://localhost:3000", deps)).rejects.toThrow("pstdio serve");
    await expect(ensureApi("http://localhost:3000", deps)).rejects.toThrow(logPath);
  });

  it("wraps spawn failures with the log path", async () => {
    process.env.PSTDIO_LOG_PATH = logPath;
    const deps: EnsureApiDeps = {
      isHealthy: async () => false,
      waitForHealthy: async () => {},
      runApi: () => {
        throw new Error("spawn ENOENT");
      },
    };

    await expect(ensureApi("http://localhost:3000", deps)).rejects.toThrow("API process failed to spawn");
    await expect(ensureApi("http://localhost:3000", deps)).rejects.toThrow("spawn ENOENT");
    await expect(ensureApi("http://localhost:3000", deps)).rejects.toThrow(logPath);
  });

  it("wraps health-check timeouts with the log path", async () => {
    process.env.PSTDIO_LOG_PATH = logPath;
    const deps: EnsureApiDeps = {
      isHealthy: async () => false,
      waitForHealthy: async () => {
        throw new Error("Service at http://localhost:3000/healthz did not become healthy within 15000ms");
      },
      runApi: () => ({ apiRoot: "/fake", child: {} }),
    };

    await expect(ensureApi("http://localhost:3000", deps)).rejects.toThrow("API did not become healthy in 15s");
    await expect(ensureApi("http://localhost:3000", deps)).rejects.toThrow(logPath);
  });

  it("includes captured api output when health check times out", async () => {
    process.env.PSTDIO_LOG_PATH = logPath;
    const deps = loggingDeps("PANIC: could not locate a valid checkpoint record");

    await expect(ensureApi("http://localhost:3000", deps)).rejects.toThrow(
      "PANIC: could not locate a valid checkpoint record",
    );
  });

  // The hint ships inside the published CLI, so it must carry the repair steps itself.
  it("spells out WAL recovery steps instead of pointing at repo-only docs", async () => {
    // The db path is a fixture, so the startup logger has to be pointed somewhere writable —
    // it otherwise derives its own path from the db path and tries to create that directory.
    process.env.PSTDIO_LOG_PATH = logPath;
    process.env.PSTDIO_DB_PATH = "/home/dev/.pstdio/pstdio.db";
    const deps = loggingDeps("RuntimeError: Aborted(). Build with -sASSERTIONS for more info.");

    await expect(ensureApi("http://localhost:3000", deps)).rejects.toThrow(
      "pg_resetwal -f '/home/dev/.pstdio/pstdio.db'",
    );
    await expect(ensureApi("http://localhost:3000", deps)).rejects.not.toThrow(/docs\//);
  });

  it("reports when the child exits before becoming healthy", async () => {
    process.env.PSTDIO_LOG_PATH = logPath;
    let exitListener: ((code: number | null, signal: NodeJS.Signals | null) => void) | undefined;
    const deps: EnsureApiDeps = {
      isHealthy: async () => false,
      waitForHealthy: async () => {
        await Bun.sleep(1);
        exitListener?.(7, null);
        await Bun.sleep(10);
        throw new Error("health check timed out");
      },
      runApi: () => ({
        apiRoot: "/fake",
        child: {
          once: (event: string, listener: (code: number | null, signal: NodeJS.Signals | null) => void) => {
            if (event === "exit") exitListener = listener;
          },
          off: () => {},
        } as never,
      }),
    };

    await expect(ensureApi("http://localhost:3000", deps)).rejects.toThrow("exited with code 7");
  });

  it("terminates the child when the health check times out", async () => {
    process.env.PSTDIO_LOG_PATH = logPath;
    let killed = false;
    const deps: EnsureApiDeps = {
      isHealthy: async () => false,
      waitForHealthy: async () => {
        throw new Error("health check timed out");
      },
      runApi: () => ({
        apiRoot: "/fake",
        child: {
          kill: () => {
            killed = true;
            return true;
          },
        },
      }),
    };

    await expect(ensureApi("http://localhost:3000", deps)).rejects.toThrow("health check timed out");
    expect(killed).toBe(true);
  });
});
