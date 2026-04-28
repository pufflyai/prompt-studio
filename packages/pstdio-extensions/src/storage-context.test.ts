import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createDb, createProjectsDBService } from "pstdio-db";
import { createExtensionStorageContext } from "./storage-context";

let close: () => Promise<void>;
let db: Awaited<ReturnType<typeof createDb>>["db"];
let projectId: string;

beforeEach(async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  db = result.db;
  projectId = (await createProjectsDBService(db).create({ name: "runtime-storage" })).id;
});

afterEach(async () => {
  await close?.();
});

describe("createExtensionStorageContext", () => {
  test("exposes KV, collection, template preference, and skill preference helpers", async () => {
    const storage = createExtensionStorageContext({
      db,
      projectId,
      extensionId: "project.templates",
      scope: { type: "project", id: "" },
    });

    await storage.set("lastSetup", { completed: true });
    expect(await storage.get("lastSetup")).toEqual({ completed: true });

    const statuses = storage.collection("statuses");
    await statuses.put("backlog", { label: "Backlog" });
    await statuses.put("ready", { label: "Ready" });

    expect(await statuses.get("backlog")).toEqual({ label: "Backlog" });
    expect(await statuses.list()).toEqual([
      { id: "backlog", value: { label: "Backlog" } },
      { id: "ready", value: { label: "Ready" } },
    ]);

    expect(await storage.templatePreferences.isEnabled("defaultTicket")).toBe(true);
    await storage.templatePreferences.setEnabled("defaultTicket", false);
    expect(await storage.templatePreferences.isEnabled("defaultTicket")).toBe(false);

    expect(await storage.skillPreferences.isEnabled("labSkill")).toBe(true);
    await storage.skillPreferences.setEnabled("labSkill", false);
    expect(await storage.skillPreferences.isEnabled("labSkill")).toBe(false);

    await storage.delete("lastSetup");
    await statuses.delete("ready");

    expect(await storage.get("lastSetup")).toBeNull();
    expect(await statuses.get("ready")).toBeNull();
  });
});
