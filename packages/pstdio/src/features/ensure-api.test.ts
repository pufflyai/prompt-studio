import { afterEach, describe, expect, it } from "bun:test";
import { type EnsureApiDeps, ensureApi } from "./ensure-api";

const originalDisableAutoStart = process.env.PSTDIO_DISABLE_API_AUTO_START;
const originalLogPath = process.env.PSTDIO_LOG_PATH;
const logPath = "/tmp/pstdio-test-logs.jsonl";

const healthyDeps = (spies = { runApiCalled: false }): EnsureApiDeps => ({
  isHealthy: async () => true,
  waitForHealthy: async () => {},
  runApi: () => {
    spies.runApiCalled = true;
    return null;
  },
});

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
  });

  it("does nothing when api is already healthy", async () => {
    const spies = { runApiCalled: false };
    await ensureApi("http://localhost:3000", healthyDeps(spies));
    expect(spies.runApiCalled).toBe(false);
  });

  it("starts api when not healthy", async () => {
    const spies = { runApiCalled: false };
    await ensureApi("http://localhost:3000", unhealthyThenHealthyDeps(spies));
    expect(spies.runApiCalled).toBe(true);
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
    const listeners: Array<(chunk: Buffer) => void> = [];
    const deps: EnsureApiDeps = {
      isHealthy: async () => false,
      waitForHealthy: async () => {
        for (const listener of listeners) listener(Buffer.from("PANIC: could not locate a valid checkpoint record\n"));
        throw new Error("Service at http://localhost:3000/healthz did not become healthy within 15000ms");
      },
      runApi: () => ({
        apiRoot: "/fake",
        child: {
          stderr: {
            on: (_event: string, listener: (chunk: Buffer) => void) => {
              listeners.push(listener);
            },
          },
        } as never,
      }),
    };

    await expect(ensureApi("http://localhost:3000", deps)).rejects.toThrow(
      "PANIC: could not locate a valid checkpoint record",
    );
  });
});
