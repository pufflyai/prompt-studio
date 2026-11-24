import { expect, jest, test } from "bun:test";
import { Hono } from "hono";
import { createRequestQuietPeriod } from "./request-quiet-period";

test("a write postpones background maintenance until thirty seconds without writes", async () => {
  jest.useFakeTimers();
  const quiet = createRequestQuietPeriod();
  const app = new Hono();
  app.use("*", quiet.observe);
  app.post("/save", (context) => context.text("saved"));
  try {
    expect(quiet.isQuiet()).toBe(false);
    jest.advanceTimersByTime(30_000);
    expect(quiet.isQuiet()).toBe(true);
    expect((await app.request("/save", { method: "POST" })).status).toBe(200);
    expect(quiet.isQuiet()).toBe(false);
    jest.advanceTimersByTime(29_999);
    expect(quiet.isQuiet()).toBe(false);
    jest.advanceTimersByTime(1);
    expect(quiet.isQuiet()).toBe(true);
    expect((await app.request("/missing", { method: "POST" })).status).toBe(404);
    expect(quiet.isQuiet()).toBe(false);
  } finally {
    jest.useRealTimers();
  }
});

test("idle read polling does not starve maintenance", async () => {
  jest.useFakeTimers();
  const quiet = createRequestQuietPeriod();
  const app = new Hono();
  app.use("*", quiet.observe);
  app.get("/v1/agents/query", (context) => context.json({ agents: [] }));
  app.post("/v1/projects/:projectId/resource-anchors/query-page", (context) => context.json({ items: [] }));
  app.get("/readyz", (context) => context.text("ready"));
  try {
    for (let index = 0; index < 4; index++) {
      jest.advanceTimersByTime(15_000);
      expect((await app.request("/v1/agents/query")).status).toBe(200);
      expect((await app.request("/v1/projects/project/resource-anchors/query-page", { method: "POST" })).status).toBe(
        200,
      );
      expect((await app.request("/readyz")).status).toBe(200);
    }
    expect(quiet.isQuiet()).toBe(true);
  } finally {
    jest.useRealTimers();
  }
});

test("a query-named dynamic action remains a write", async () => {
  jest.useFakeTimers();
  const quiet = createRequestQuietPeriod();
  const app = new Hono();
  app.use("*", quiet.observe);
  app.post("/mutations/:action", (context) => context.text("saved"));
  try {
    jest.advanceTimersByTime(30_000);
    expect(quiet.isQuiet()).toBe(true);
    expect((await app.request("/mutations/query", { method: "POST" })).status).toBe(200);
    expect(quiet.isQuiet()).toBe(false);
    jest.advanceTimersByTime(30_000);
    expect((await app.request("/missing/query", { method: "POST" })).status).toBe(404);
    expect(quiet.isQuiet()).toBe(false);
  } finally {
    jest.useRealTimers();
  }
});

test("an active read holds maintenance without restarting its idle window", async () => {
  jest.useFakeTimers();
  const quiet = createRequestQuietPeriod();
  const app = new Hono();
  const started = Promise.withResolvers<void>();
  const finish = Promise.withResolvers<void>();
  app.use("*", quiet.observe);
  app.get("/read", async (context) => {
    started.resolve();
    await finish.promise;
    return context.text("read");
  });
  try {
    jest.advanceTimersByTime(30_000);
    const request = app.request("/read");
    await started.promise;
    expect(quiet.isQuiet()).toBe(false);
    finish.resolve();
    expect((await request).status).toBe(200);
    expect(quiet.isQuiet()).toBe(true);
  } finally {
    finish.resolve();
    jest.useRealTimers();
  }
});
