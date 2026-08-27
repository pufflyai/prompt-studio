import { describe, expect, test } from "bun:test";
import { makeCommandContext } from "../commands/command-context.fixture";
import { createMemoryStorage } from "./memory-storage";
import { deleteOwnedTemplate, listOwnedTemplates, readOwnedTemplate, saveOwnedTemplate } from "./template-store";

describe("planner template storage", () => {
  test("prefers a project override to the shipped package asset", async () => {
    const storage = createMemoryStorage();
    const ctx = makeCommandContext({
      storage,
      params: {},
      overrides: { packageFiles: { readText: async () => "Shipped content" } },
    });

    expect((await readOwnedTemplate(ctx, "implement-ticket"))?.content).toBe("Shipped content");
    await saveOwnedTemplate(ctx, {
      name: "implement-ticket",
      title: "Implement ticket",
      type: "prompt",
      content: "Project override",
    });

    expect((await readOwnedTemplate(ctx, "implement-ticket"))?.content).toBe("Project override");
    expect(await listOwnedTemplates(ctx, "prompt")).toContainEqual({
      name: "implement-ticket",
      title: "Implement ticket",
      type: "prompt",
    });
  });

  test("keeps the previous override when its replacement record cannot be saved", async () => {
    const storage = createMemoryStorage();
    const base = makeCommandContext({ storage, params: {} });
    await saveOwnedTemplate(base, {
      name: "implement-ticket",
      type: "prompt",
      content: "Previous override",
    });
    const collection = storage.collection.bind(storage);
    const failingStorage = {
      ...storage,
      collection<TItem>(name: string) {
        const api = collection<TItem>(name);
        return name === "templates" ? { ...api, put: async () => Promise.reject(new Error("write failed")) } : api;
      },
    };
    const failing = makeCommandContext({ storage: failingStorage, params: {} });

    await expect(
      saveOwnedTemplate(failing, {
        name: "implement-ticket",
        type: "prompt",
        content: "Replacement",
      }),
    ).rejects.toThrow("write failed");
    expect((await readOwnedTemplate(base, "implement-ticket"))?.content).toBe("Previous override");
  });

  test("keeps a template readable when its logical deletion fails", async () => {
    const storage = createMemoryStorage();
    const base = makeCommandContext({ storage, params: {} });
    await saveOwnedTemplate(base, { name: "custom", type: "prompt", content: "Keep me" });
    const collection = storage.collection.bind(storage);
    const failing = makeCommandContext({
      storage: {
        ...storage,
        collection<TItem>(name: string) {
          const api = collection<TItem>(name);
          return name === "templates"
            ? { ...api, delete: async () => Promise.reject(new Error("delete failed")) }
            : api;
        },
      },
      params: {},
    });

    await expect(deleteOwnedTemplate(failing, "custom")).rejects.toThrow("delete failed");
    expect((await readOwnedTemplate(base, "custom"))?.content).toBe("Keep me");
  });

  test("applies migrated preferences and orders the configured default first", async () => {
    const storage = createMemoryStorage();
    const ctx = makeCommandContext({ storage, params: {} });
    await storage.collection("template-preferences").put("implement-ticket", {
      enabled: true,
      displayName: "My implementation prompt",
      metadata: {},
    });
    await storage.collection("template-preferences").put("refine-ticket", {
      enabled: false,
      displayName: null,
      metadata: {},
    });
    await storage.set("template-defaults", { prompt: "implement-ticket" });

    const prompts = await listOwnedTemplates(ctx, "prompt");

    expect(prompts[0]).toMatchObject({ name: "implement-ticket", title: "My implementation prompt" });
    expect(prompts.some((template) => template.name === "refine-ticket")).toBe(false);
    expect((await readOwnedTemplate(ctx, "implement-ticket"))?.title).toBe("My implementation prompt");
    expect(await readOwnedTemplate(ctx, "refine-ticket")).toBeNull();
  });
});
