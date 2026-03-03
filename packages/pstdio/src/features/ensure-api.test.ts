import { describe, expect, it } from "bun:test";
import { type EnsureApiDeps, ensureApi } from "./ensure-api";

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
    const deps: EnsureApiDeps = {
      isHealthy: async () => false,
      waitForHealthy: async () => {},
      runApi: () => null,
    };

    expect(ensureApi("http://localhost:3000", deps)).rejects.toThrow("Could not start the pstdio API");
  });
});
