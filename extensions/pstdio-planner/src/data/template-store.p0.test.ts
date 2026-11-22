import { describe, expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandContext } from "../commands/command-context.fixture";
import {
  deleteOwnedTemplate,
  listOwnedTemplates,
  readOwnedTemplate,
  resetOwnedTemplate,
  saveOwnedTemplate,
} from "./template-store";

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
      source: "project",
      packageVersion: expect.any(String),
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

test("template reads identify package defaults and project overrides", async () => {
  const ctx = makeCommandContext({ storage: createMemoryStorage(), params: {} });
  expect(await readOwnedTemplate(ctx, "cleanup-board")).toMatchObject({
    source: "package",
    packageVersion: expect.any(String),
  });
  await saveOwnedTemplate(ctx, { name: "cleanup-board", type: "prompt", content: "My cleanup" });
  expect(await readOwnedTemplate(ctx, "cleanup-board")).toMatchObject({
    source: "project",
    content: "My cleanup",
    packageVersion: expect.any(String),
  });
  expect(await listOwnedTemplates(ctx, "prompt")).toContainEqual(
    expect.objectContaining({ name: "cleanup-board", source: "project" }),
  );
});

test("reset restores the current package template without changing other overrides", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({
    storage,
    params: {},
    overrides: { packageFiles: { readText: async () => "Current shipped cleanup" } },
  });
  await saveOwnedTemplate(ctx, { name: "cleanup-board", type: "prompt", content: "Old cleanup" });
  await saveOwnedTemplate(ctx, { name: "implement-ticket", type: "prompt", content: "Keep my implementation" });
  const record = await storage.collection<{ blobId: string }>("templates").get("cleanup-board");
  expect(await resetOwnedTemplate(ctx, "cleanup-board")).toMatchObject({
    source: "package",
    content: "Current shipped cleanup",
  });
  expect(await storage.collection("templates").get("cleanup-board")).toBeUndefined();
  await expect(storage.collection("templates").attachments("cleanup-board").getBytes(record!.blobId)).rejects.toThrow();
  expect(await readOwnedTemplate(ctx, "implement-ticket")).toMatchObject({
    source: "project",
    content: "Keep my implementation",
  });
  await deleteOwnedTemplate(ctx, "cleanup-board");
  expect(await readOwnedTemplate(ctx, "cleanup-board")).toBeNull();
  expect(await resetOwnedTemplate(ctx, "cleanup-board")).toMatchObject({ source: "package" });
});

test("reset rejects custom templates and preserves their contents", async () => {
  const ctx = makeCommandContext({ storage: createMemoryStorage(), params: {} });
  await saveOwnedTemplate(ctx, { name: "custom", type: "prompt", content: "My custom template" });
  await expect(resetOwnedTemplate(ctx, "custom")).rejects.toThrow("No package template to restore");
  expect(await readOwnedTemplate(ctx, "custom")).toMatchObject({ content: "My custom template" });
});

test("failed reset preserves the override and its attachment", async () => {
  const storage = createMemoryStorage();
  const base = makeCommandContext({ storage, params: {} });
  await saveOwnedTemplate(base, { name: "cleanup-board", type: "prompt", content: "Keep this cleanup" });
  const collection = storage.collection.bind(storage);
  const ctx = makeCommandContext({
    storage: {
      ...storage,
      collection<TItem>(name: string) {
        const api = collection<TItem>(name);
        return name === "templates"
          ? {
              ...api,
              delete: async () => {
                throw new Error("write failed");
              },
            }
          : api;
      },
    },
    params: {},
  });
  await expect(resetOwnedTemplate(ctx, "cleanup-board")).rejects.toThrow("write failed");
  expect(await readOwnedTemplate(base, "cleanup-board")).toMatchObject({
    source: "project",
    content: "Keep this cleanup",
  });
});

test("reset preserves display and disabled preferences", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });
  await saveOwnedTemplate(ctx, { name: "cleanup-board", type: "prompt", content: "Old cleanup" });
  await storage.collection("template-preferences").put("cleanup-board", { enabled: false, displayName: "My cleanup" });
  expect(await resetOwnedTemplate(ctx, "cleanup-board")).toBeNull();
  await storage.collection("template-preferences").put("cleanup-board", { enabled: true, displayName: "My cleanup" });
  expect(await readOwnedTemplate(ctx, "cleanup-board")).toMatchObject({ source: "package", title: "My cleanup" });
});

test("failed package read preserves the saved override during reset", async () => {
  const storage = createMemoryStorage();
  const base = makeCommandContext({ storage, params: {} });
  await saveOwnedTemplate(base, { name: "cleanup-board", type: "prompt", content: "Keep this cleanup" });
  const ctx = makeCommandContext({
    storage,
    params: {},
    overrides: {
      packageFiles: {
        readText: async () => {
          throw new Error("Package file unavailable");
        },
      },
    },
  });
  await expect(resetOwnedTemplate(ctx, "cleanup-board")).rejects.toThrow("Package file unavailable");
  expect(await readOwnedTemplate(base, "cleanup-board")).toMatchObject({
    source: "project",
    content: "Keep this cleanup",
  });
});
