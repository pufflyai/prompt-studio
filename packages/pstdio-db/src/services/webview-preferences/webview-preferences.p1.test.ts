import { expect, test } from "bun:test";
import { createDb } from "../../db/connection.pglite";
import { createWebviewPreferencesDBService } from "./webview-preferences";

test("server preferences share values across clients and isolate owners and scopes", async () => {
  const { db, close } = await createDb({ path: ":memory:" });
  try {
    const first = createWebviewPreferencesDBService(db);
    const second = createWebviewPreferencesDBService(db);
    const key = { extension_id: "acme.a", name: "lastRange", scope_type: "user", scope_id: "" };
    await first.set({ ...key, value_json: "now-6h" });
    expect(await second.get(key)).toBe("now-6h");
    expect(await second.get({ ...key, extension_id: "acme.b" })).toBeUndefined();
    expect(await second.get({ ...key, scope_type: "project", scope_id: "p1" })).toBeUndefined();
    await second.set({ ...key, value_json: { nested: [true, "now-24h"] } });
    expect(await first.get(key)).toEqual({ nested: [true, "now-24h"] });
  } finally {
    await close();
  }
});

test("preference writes enforce value and owner limits atomically", async () => {
  const { db, close } = await createDb({ path: ":memory:" });
  try {
    const service = createWebviewPreferencesDBService(db);
    const key = { extension_id: "acme.a", name: "large", scope_type: "user", scope_id: "" };
    await expect(service.set({ ...key, value_json: "a".repeat(16385) })).rejects.toThrow("preference_too_large");
    for (let index = 0; index < 16; index++)
      await service.set({ ...key, name: String(index), value_json: "a".repeat(16382) });
    await expect(service.set({ ...key, value_json: "extra" })).rejects.toThrow("preference_too_large");
    expect(await service.get(key)).toBeUndefined();
    await service.set({ ...key, name: "0", value_json: "smaller" });
    await service.set({ ...key, value_json: "extra" });
    expect(await service.get(key)).toBe("extra");
  } finally {
    await close();
  }
});
