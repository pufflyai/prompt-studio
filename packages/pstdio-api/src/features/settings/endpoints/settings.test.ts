import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../../test-utils/create-test-app";

type SettingsTestContext = Awaited<ReturnType<typeof createTestApp>> & {
  cleanup: () => Promise<void>;
};

let context!: SettingsTestContext;

beforeAll(async () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-settings-test-"));
  const previousHomeEnv = process.env.HOME;
  const previousPstdioHomeEnv = process.env.PSTDIO_HOME;

  const testHome = join(tempRoot, "home");
  mkdirSync(testHome, { recursive: true });
  process.env.HOME = testHome;
  process.env.PSTDIO_HOME = join(testHome, ".pstdio");

  const appContext = await createTestApp({
    databasePath: ":memory:",
    storageRoot: join(tempRoot, "storage"),
  });

  context = {
    ...appContext,
    cleanup: async () => {
      await appContext.close();

      if (previousHomeEnv === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = previousHomeEnv;
      }

      if (previousPstdioHomeEnv === undefined) {
        delete process.env.PSTDIO_HOME;
      } else {
        process.env.PSTDIO_HOME = previousPstdioHomeEnv;
      }

      rmSync(tempRoot, { recursive: true, force: true });
    },
  };
}, 15_000);

afterAll(async () => {
  await context?.cleanup();
});

describe("/v1/settings", () => {
  test("gets default global settings", async () => {
    const response = await context.app.request("/v1/settings");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ max_concurrent_sessions: null, notifications_enabled: false });
  });

  test("updates max concurrent sessions", async () => {
    const response = await context.app.request("/v1/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ max_concurrent_sessions: 1 }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ max_concurrent_sessions: 1, notifications_enabled: false });
  });

  test("accepts unlimited max concurrent sessions", async () => {
    await context.app.request("/v1/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ max_concurrent_sessions: 1 }),
    });

    const response = await context.app.request("/v1/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ max_concurrent_sessions: null }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ max_concurrent_sessions: null, notifications_enabled: false });
  });
});

test("validates and synchronizes notification opt-in without changing capacity", async () => {
  const patch = (body: unknown) =>
    context.app.request("/v1/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const invalid = await patch({ notifications_enabled: "true" });
  expect(invalid.status).toBe(400);
  await patch({ max_concurrent_sessions: 3 });
  const response = await patch({ notifications_enabled: true });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ max_concurrent_sessions: 3, notifications_enabled: true });
  const current = await context.app.request("/v1/settings");
  expect(await current.json()).toEqual({ max_concurrent_sessions: 3, notifications_enabled: true });
});
