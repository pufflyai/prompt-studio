import { describe, expect, test } from "bun:test";
import { isHealthy, waitForHealthy } from "./health-check";

const okFetcher = () => Promise.resolve({ ok: true } as Response);

const failFetcher = () => Promise.reject(new Error("ECONNREFUSED"));

const notOkFetcher = () => Promise.resolve({ ok: false } as Response);

describe("isHealthy", () => {
  test("returns true when fetcher responds ok", async () => {
    expect(await isHealthy("http://localhost:3000/healthz", okFetcher)).toBe(true);
  });

  test("returns false when fetcher throws", async () => {
    expect(await isHealthy("http://localhost:3000/healthz", failFetcher)).toBe(false);
  });

  test("returns false when response is not ok", async () => {
    expect(await isHealthy("http://localhost:3000/healthz", notOkFetcher)).toBe(false);
  });
});

describe("waitForHealthy", () => {
  test("resolves when healthy on first attempt", async () => {
    await waitForHealthy({ url: "http://localhost:3000/healthz", fetcher: okFetcher });
  });

  test("resolves after retries", async () => {
    let attempts = 0;
    const fetcher = () => {
      attempts++;
      return attempts >= 3 ? okFetcher() : failFetcher();
    };

    await waitForHealthy({
      url: "http://localhost:3000/healthz",
      intervalMs: 10,
      timeoutMs: 2000,
      fetcher,
    });

    expect(attempts).toBe(3);
  });

  test("does not treat system clock jumps as timeout", async () => {
    const originalNow = Date.now;
    let jumped = false;
    let attempts = 0;
    Date.now = () => originalNow() + (jumped ? 60_000 : 0);

    const fetcher = () => {
      attempts++;
      jumped = true;
      return attempts >= 2 ? okFetcher() : notOkFetcher();
    };

    try {
      await waitForHealthy({
        url: "http://localhost:3000/healthz",
        intervalMs: 1,
        timeoutMs: 50,
        fetcher,
      });
    } finally {
      Date.now = originalNow;
    }

    expect(attempts).toBe(2);
  });

  test("throws after timeout", async () => {
    await expect(
      waitForHealthy({
        url: "http://localhost:3000/healthz",
        intervalMs: 10,
        timeoutMs: 50,
        fetcher: failFetcher,
      }),
    ).rejects.toThrow("did not become healthy");
  });
});
