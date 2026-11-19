import { describe, expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { cleanupLegacyWorkspaceStatus } from "./cleanup-legacy-workspace-status";

describe("cleanupLegacyWorkspaceStatus", () => {
  test("removes only legacy workspace status storage and is idempotent", async () => {
    const storage = createMemoryStorage();
    await storage.set("workspace-status-definitions-initialized", true);
    await storage.set("unrelated", "keep");
    for (let index = 0; index < 205; index++) {
      await storage.collection("workspace-status-definitions").put(`status-${index}`, { id: `status-${index}` });
      await storage
        .collection("workspace-status-values")
        .put(`workspace-${index}`, { workspaceId: `workspace-${index}` });
    }
    await storage.collection("templates").put("keep", { id: "keep" });
    const collection = storage.collection.bind(storage);
    storage.collection = <T>(name: string) => ({
      ...collection<T>(name),
      list: async () => {
        throw new Error(`Unbounded ${name}`);
      },
    });

    await cleanupLegacyWorkspaceStatus(storage);
    await cleanupLegacyWorkspaceStatus(storage);

    expect(await storage.get("workspace-status-definitions-initialized")).toBeUndefined();
    expect(await storage.get("unrelated")).toBe("keep");
    expect(await collection("workspace-status-definitions").list()).toEqual([]);
    expect(await collection("workspace-status-values").list()).toEqual([]);
    expect(await collection("templates").get("keep")).toEqual({ id: "keep" });
  });

  test.each(["changed", "unpublished"] as const)("stops a %s cleanup batch without repeating writes", async (mode) => {
    const storage = createMemoryStorage();
    await storage.collection("workspace-status-definitions").put("legacy", { id: "legacy" });
    await storage.set("workspace-status-definitions-initialized", true);
    let attempts = 0;
    const publish = async (input: { operationId: string }) => {
      if (++attempts > 1) throw new Error("Repeated an unpublished cleanup batch");
      return { operationId: input.operationId, state: "saved-locally" as const, status: "saved-locally" as const };
    };
    storage.records.commit = publish;
    storage.records.commitIfCurrent = (input) =>
      mode === "changed" ? (++attempts, Promise.resolve(null)) : publish(input);

    await expect(cleanupLegacyWorkspaceStatus(storage)).rejects.toThrow(
      mode === "changed" ? "Legacy workspace status cleanup changed" : "Legacy workspace status cleanup is not visible",
    );
    expect(attempts).toBe(1);
    expect(await storage.get("workspace-status-definitions-initialized")).toBe(true);
  });
});
