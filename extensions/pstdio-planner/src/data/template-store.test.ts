import { describe, expect, test } from "bun:test";
import { makeCommandContext } from "../commands/command-context.fixture";
import { createMemoryStorage } from "./memory-storage";
import { listOwnedTemplates, readOwnedTemplate, saveOwnedTemplate } from "./template-store";

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
});
