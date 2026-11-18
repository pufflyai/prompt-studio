import { describe, expect, test } from "bun:test";
import { cleanupLegacyWorkspaceStatus } from "./cleanup-legacy-workspace-status";

describe("cleanupLegacyWorkspaceStatus", () => {
  test("removes only legacy workspace status storage and is idempotent", async () => {
    const keys = new Map<string, unknown>([
      ["workspace-status-definitions-initialized", true],
      ["unrelated", "keep"],
    ]);
    const collections = new Map<string, Map<string, unknown>>([
      ["workspace-status-definitions", new Map([["wip", { id: "wip" }]])],
      ["workspace-status-values", new Map([["workspace-1", { workspaceId: "workspace-1" }]])],
      ["tickets", new Map([["ticket-1", { id: "ticket-1" }]])],
    ]);
    const storage = {
      delete: async (key: string) => keys.delete(key),
      collection: (name: string) => ({
        list: async () => [...(collections.get(name)?.values() ?? [])],
        delete: async (id: string) => collections.get(name)?.delete(id),
      }),
    } as never;

    await cleanupLegacyWorkspaceStatus(storage);
    await cleanupLegacyWorkspaceStatus(storage);

    expect(keys).toEqual(new Map([["unrelated", "keep"]]));
    expect(collections.get("workspace-status-definitions")?.size).toBe(0);
    expect(collections.get("workspace-status-values")?.size).toBe(0);
    expect(collections.get("tickets")?.size).toBe(1);
  });
});
