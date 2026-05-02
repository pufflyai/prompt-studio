import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { DbClient } from "../../db/connection.pglite";
import { createDb } from "../../db/connection.pglite";
import { createInstalledExtensionSourcesDBService } from "./installed-extension-sources";

let db: DbClient;
let close: () => Promise<void>;
let service: ReturnType<typeof createInstalledExtensionSourcesDBService>;

beforeEach(async () => {
  const conn = await createDb({ path: ":memory:" });
  db = conn.db;
  close = conn.close;
  service = createInstalledExtensionSourcesDBService(db);
});

afterEach(async () => {
  await close();
});

const baseInput = {
  install_name: "planner",
  extension_id: "pstdio.planner",
  namespace: "planner",
  display_name: "Planner",
  source_path: "/Users/test/.pstdio/extensions/planner",
  source_kind: "catalog" as const,
};

describe("installed-extension-sources service", () => {
  test("create stores the row with manifest defaults", async () => {
    const created = await service.create(baseInput);

    expect(created.install_name).toBe("planner");
    expect(created.manifest_json).toEqual({});
    expect(created.created_at).toBeTruthy();
  });

  test("get returns a row by id", async () => {
    const created = await service.create(baseInput);

    const fetched = await service.get(created.id);
    expect(fetched?.install_name).toBe("planner");

    const missing = await service.get("does-not-exist");
    expect(missing).toBeNull();
  });

  test("getByInstallName returns the row", async () => {
    await service.create(baseInput);

    const fetched = await service.getByInstallName("planner");
    expect(fetched?.extension_id).toBe("pstdio.planner");
  });

  test("list returns all installed sources sorted by install_name", async () => {
    await service.create({ ...baseInput, install_name: "extension-lab", source_path: "/tmp/extension-lab" });
    await service.create(baseInput);

    const all = await service.list();
    expect(all.map((r) => r.install_name)).toEqual(["extension-lab", "planner"]);
  });

  test("install_name uniqueness is enforced", async () => {
    await service.create(baseInput);
    await expect(service.create({ ...baseInput, source_path: "/tmp/other" })).rejects.toThrow();
  });

  test("source_path uniqueness is enforced", async () => {
    await service.create(baseInput);
    await expect(service.create({ ...baseInput, install_name: "planner-copy" })).rejects.toThrow();
  });

  test("update merges fields and bumps updated_at", async () => {
    const created = await service.create(baseInput);

    const updated = await service.update(created.id, {
      manifest_json: { version: "1.2.3" },
      last_loaded_at: "2026-05-02T10:00:00.000Z",
    });

    expect(updated?.manifest_json).toEqual({ version: "1.2.3" });
    expect(updated?.last_loaded_at).toBe("2026-05-02T10:00:00.000Z");
    expect(updated?.updated_at >= created.updated_at).toBe(true);
  });

  test("remove deletes the row", async () => {
    const created = await service.create(baseInput);

    const removed = await service.remove(created.id);
    expect(removed).toBe(true);

    expect(await service.get(created.id)).toBeNull();
  });
});
