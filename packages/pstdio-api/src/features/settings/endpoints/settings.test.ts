import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../../../app";

type SettingsTestContext = Awaited<ReturnType<typeof createApp>> & {
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

  const appContext = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
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
    await expect(response.json()).resolves.toEqual({ max_concurrent_sessions: null });
  });

  test("updates max concurrent sessions", async () => {
    const response = await context.app.request("/v1/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ max_concurrent_sessions: 1 }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ max_concurrent_sessions: 1 });
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
    await expect(response.json()).resolves.toEqual({ max_concurrent_sessions: null });
  });
});
