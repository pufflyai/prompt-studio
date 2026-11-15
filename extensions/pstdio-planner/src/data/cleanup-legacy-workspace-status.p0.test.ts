import { describe, expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { cleanupLegacyWorkspaceStatus } from "./cleanup-legacy-workspace-status";

describe("cleanupLegacyWorkspaceStatus", () => {
  test("removes only legacy workspace status storage and is idempotent", async () => {
    const storage = createMemoryStorage();
    await storage.set("workspace-status-definitions-initialized", true);
    await storage.set("unrelated", "keep");
    for (let i = 0; i < 203; i++) {
      await storage.collection("workspace-status-definitions").put(String(i), { id: String(i) });
      await storage.collection("workspace-status-values").put(String(i), { workspaceId: String(i) });
    }
    await storage.collection("tickets").put("ticket-1", { id: "ticket-1" });
    const collection = storage.collection.bind(storage);
    storage.collection = <T>(name: string) => ({
      ...collection<T>(name),
      list: async () => {
        throw Error("Unbounded read");
      },
    });

    await cleanupLegacyWorkspaceStatus(storage);
    await cleanupLegacyWorkspaceStatus(storage);

    expect(await storage.get("unrelated")).toBe("keep");
    expect(await storage.get("workspace-status-definitions-initialized")).toBeUndefined();
    for (const name of ["workspace-status-definitions", "workspace-status-values"])
      expect((await storage.records.aggregate({ index: `cleanup:${name}` })).count).toBe(0);
    expect(await storage.collection("tickets").get("ticket-1")).toEqual({ id: "ticket-1" });
  });
});
