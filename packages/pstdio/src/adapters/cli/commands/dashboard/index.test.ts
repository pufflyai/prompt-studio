import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { Server } from "node:http";
import packageData from "../../../../../package.json";
import { launch } from ".";

let stdoutWriteSpy: ReturnType<typeof mock>;
const originalStdoutWrite = process.stdout.write.bind(process.stdout);

beforeEach(() => {
  stdoutWriteSpy = mock((_chunk: unknown) => true);
  process.stdout.write = stdoutWriteSpy as typeof process.stdout.write;
});

afterEach(() => {
  process.stdout.write = originalStdoutWrite;
});

type StubDeps = {
  dashboardRoot?: string;
};

const createStubDeps = (overrides: StubDeps = {}) => {
  const calls = {
    serveDashboard: [] as unknown[],
    openBrowser: [] as string[],
  };

  let serverClosed = false;
  const fakeServer = {
    close: () => {
      serverClosed = true;
    },
  } as unknown as Server;

  return {
    calls,
    serverClosed: () => serverClosed,
    deps: {
      serveDashboard: (opts: unknown) => {
        calls.serveDashboard.push(opts);
        return fakeServer;
      },
      resolveDashboardRoot: () => overrides.dashboardRoot ?? "/fake/dashboard/dist",
      openBrowser: (url: string) => {
        calls.openBrowser.push(url);
      },
    },
  };
};

const sigintListeners: (() => void)[] = [];

afterEach(() => {
  for (const listener of sigintListeners) {
    process.removeListener("SIGINT", listener);
  }
  sigintListeners.length = 0;
});

describe("launch", () => {
  test("opens the discovered runtime origin in compiled mode", async () => {
    const { calls, deps } = createStubDeps();
    const previousApiUrl = process.env.PSTDIO_API_URL;
    process.env.PSTDIO_API_URL = "http://127.0.0.1:43123";

    try {
      await launch({ apiPort: 19840, dashboardPort: 5555, openBrowser: true }, deps, true);
    } finally {
      if (previousApiUrl === undefined) delete process.env.PSTDIO_API_URL;
      else process.env.PSTDIO_API_URL = previousApiUrl;
    }

    expect(calls.openBrowser).toEqual(["http://127.0.0.1:43123"]);
    expect(calls.serveDashboard).toEqual([]);
  });

  test("injects the package version into dashboard runtime config", async () => {
    const { calls, deps } = createStubDeps({ dashboardRoot: "/my/dashboard" });
    const previousVersion = process.env.PSTDIO_VERSION;
    process.env.PSTDIO_VERSION = "9.8.7";

    try {
      await launch({ apiPort: 3000, dashboardPort: 5555, openBrowser: false }, deps);
    } finally {
      if (previousVersion === undefined) {
        delete process.env.PSTDIO_VERSION;
      } else {
        process.env.PSTDIO_VERSION = previousVersion;
      }
    }

    expect(calls.serveDashboard).toEqual([
      {
        root: "/my/dashboard",
        port: 5555,
        config: { apiBaseUrl: "http://localhost:3000", version: packageData.version },
      },
    ]);
  });

  test("starts dashboard server with correct options", async () => {
    const { calls, deps } = createStubDeps({ dashboardRoot: "/my/dashboard" });

    await launch({ apiPort: 3000, dashboardPort: 5555, openBrowser: true }, deps);

    expect(calls.serveDashboard).toEqual([
      {
        root: "/my/dashboard",
        port: 5555,
        config: { apiBaseUrl: "http://localhost:3000", version: packageData.version },
      },
    ]);
  });

  test("opens browser with dashboard URL", async () => {
    const { calls, deps } = createStubDeps();

    await launch({ apiPort: 3000, dashboardPort: 5555, openBrowser: true }, deps);

    expect(calls.openBrowser).toEqual(["http://localhost:5555"]);
  });

  test("does not open browser when disabled", async () => {
    const { calls, deps } = createStubDeps();

    await launch({ apiPort: 3000, dashboardPort: 5555, openBrowser: false }, deps);

    expect(calls.openBrowser).toEqual([]);
  });

  test("uses PSTDIO_API_URL for the injected dashboard config when set", async () => {
    const { calls, deps } = createStubDeps({ dashboardRoot: "/my/dashboard" });
    const previousApiUrl = process.env.PSTDIO_API_URL;
    process.env.PSTDIO_API_URL = "http://localhost:19841";

    try {
      await launch({ apiPort: 19840, dashboardPort: 5555, openBrowser: false }, deps);
    } finally {
      if (previousApiUrl === undefined) {
        delete process.env.PSTDIO_API_URL;
      } else {
        process.env.PSTDIO_API_URL = previousApiUrl;
      }
    }

    const serveOpts = calls.serveDashboard[0] as { config: { apiBaseUrl: string } };
    expect(serveOpts.config.apiBaseUrl).toBe("http://localhost:19841");
  });
});
