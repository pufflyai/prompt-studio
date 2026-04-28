import { describe, expect, test } from "bun:test";
import type { CommandRunContext, ExtensionStorageCollection } from "@pstdio/sdk/extensions";
import { createPlannerStorage } from "./planner-storage";

const createCollection = (): ExtensionStorageCollection => {
  const values = new Map<string, unknown>();

  return {
    list: async () => [...values.entries()].map(([id, value]) => ({ id, value })),
    get: async (id) => values.get(id) ?? null,
    put: async (id, value) => {
      values.set(id, value);
    },
    delete: async (id) => {
      values.delete(id);
    },
  };
};

const createContext = () => {
  const collections = new Map<string, ExtensionStorageCollection>();

  return {
    projectId: "project-1",
    storage: {
      collection: (name: string) => {
        const existing = collections.get(name);
        if (existing) return existing;

        const created = createCollection();
        collections.set(name, created);
        return created;
      },
    },
  } as CommandRunContext;
};

describe("createPlannerStorage", () => {
  test("creates command-ingressed tickets as visible persisted tickets", async () => {
    const storage = createPlannerStorage(createContext());

    const ticket = await storage.createTicket({
      shorthand: "PS-1",
      content: "# Visible ticket",
    });

    expect(ticket.draft).toBe(false);
  });

  test("throws when resolving a missing status name", async () => {
    const storage = createPlannerStorage(createContext());

    await expect(storage.provider.resolveStatusId("missing")).rejects.toThrow("Status not found: missing");
  });

  test("throws when resolving a missing tag option name", async () => {
    const storage = createPlannerStorage(createContext());

    await expect(storage.provider.resolveTagIds(["missing"])).rejects.toThrow("Tag option not found: missing");
  });

  test("exposes stored tag ids as tag names through the workflow provider", async () => {
    const ctx = createContext();
    await ctx.storage.collection("tag_options").put("tag-1", { id: "tag-1", name: "bug" });
    const storage = createPlannerStorage(ctx);

    await storage.createTicket({
      shorthand: "PS-1",
      content: "# Tagged ticket",
      tagIds: ["tag-1"],
    });

    await expect(storage.provider.getByShorthand("PS-1")).resolves.toMatchObject({ tagNames: ["bug"] });
  });
});
