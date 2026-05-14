import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { DbClient } from "../../db/connection.pglite";
import { createDb } from "../../db/connection.pglite";
import { createSettingsDBService } from "./settings";

let close: () => Promise<void>;
let settingsService: ReturnType<typeof createSettingsDBService>;

beforeEach(async () => {
  const conn = await createDb({ path: ":memory:" });
  const db: DbClient = conn.db;
  close = conn.close;
  settingsService = createSettingsDBService(db);
});

afterEach(async () => {
  await close();
});

describe("settings service", () => {
  test("defaults max concurrent sessions to unlimited", async () => {
    await expect(settingsService.get()).resolves.toMatchObject({ max_concurrent_sessions: null });
  });

  test("updates max concurrent sessions", async () => {
    await expect(settingsService.update({ max_concurrent_sessions: 1 })).resolves.toMatchObject({
      max_concurrent_sessions: 1,
    });

    await expect(settingsService.update({ max_concurrent_sessions: null })).resolves.toMatchObject({
      max_concurrent_sessions: null,
    });
  });
});
