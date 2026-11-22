import { expect, jest, test } from "bun:test";
import { Hono } from "hono";
import { createRequestQuietPeriod } from "./request-quiet-period";

test("a new HTTP request postpones background maintenance until thirty seconds without arrivals", async () => {
  jest.useFakeTimers();
  const quiet = createRequestQuietPeriod();
  const app = new Hono();
  app.use("*", quiet.observe);
  app.get("/ready", (context) => context.text("ready"));
  try {
    expect(quiet.isQuiet()).toBe(false);
    jest.advanceTimersByTime(30_000);
    expect(quiet.isQuiet()).toBe(true);
    expect((await app.request("/ready")).status).toBe(200);
    expect(quiet.isQuiet()).toBe(false);
    jest.advanceTimersByTime(29_999);
    expect(quiet.isQuiet()).toBe(false);
    jest.advanceTimersByTime(1);
    expect(quiet.isQuiet()).toBe(true);
    expect((await app.request("/missing")).status).toBe(404);
    expect(quiet.isQuiet()).toBe(false);
  } finally {
    jest.useRealTimers();
  }
});
