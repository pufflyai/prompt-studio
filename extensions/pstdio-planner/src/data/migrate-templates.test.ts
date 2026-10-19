import { expect, test } from "bun:test";
import type { JsonObject } from "@pstdio/sdk/extensions";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandContext } from "../commands/command-context.fixture";
import { listOwnedTemplates, readOwnedTemplate } from "./template-store";

const source = (records: JsonObject[]) => ({ version: "0027-before-removal", records });
const template = (id: string, name: string, type = "prompt") => ({
  id,
  project_id: "proj-1",
  name,
  template_type: type,
  file_id: id,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
  deleted_at: null,
});

test("pstdio-planner imports its old content, preferences, and defaults through public storage", async () => {
  const storage = createMemoryStorage({
    legacyData: {
      templates: source([template("file", "custom_template"), template("other", "other_owner", "report")]),
      extension_template_preferences: source([
        {
          template_key: "custom_template",
          enabled: true,
          display_name_override: "Preferred",
          metadata_json: { pinned: true },
        },
      ]),
      project_template_defaults: source([{ template_type: "prompt", source: "project_template", template_id: "file" }]),
    },
  });
  let reads = 0;
  const ctx = makeCommandContext({
    storage,
    params: {},
    overrides: {
      files: {
        readText: async () => {
          reads++;
          return "Original content";
        },
      },
      packageFiles: { readText: async () => "Shipped" },
    },
  });
  expect(await readOwnedTemplate(ctx, "custom-template")).toMatchObject({
    content: "Original content",
    title: "Preferred",
    type: "prompt",
  });
  expect((await listOwnedTemplates(ctx))[0].name).toBe("custom-template");
  expect(await storage.get<Record<string, string>>("template-defaults")).toEqual({ prompt: "custom-template" });
  expect(await readOwnedTemplate(ctx, "custom-template")).toMatchObject({ content: "Original content" });
  expect(reads).toBe(1);
  expect(await storage.collection("templates").get("other-owner")).toBeUndefined();
});

test("pstdio-planner retries an interrupted import and preserves newer extension records", async () => {
  const storage = createMemoryStorage({
    legacyData: {
      templates: source([template("first", "first"), template("second", "second")]),
    },
  });
  let interrupted = true;
  const ctx = makeCommandContext({
    storage,
    params: {},
    overrides: {
      files: {
        readText: async (id) => {
          if (id === "second" && interrupted) throw new Error("Source unavailable");
          return id;
        },
      },
      packageFiles: { readText: async () => "Shipped" },
    },
  });
  await expect(readOwnedTemplate(ctx, "second")).rejects.toThrow("Source unavailable");
  const first = await storage.collection<Record<string, unknown>>("templates").get("first");
  await storage.collection("templates").put("first", { ...first, title: "Newer title" });
  interrupted = false;
  expect(await readOwnedTemplate(ctx, "second")).toMatchObject({ content: "second" });
  expect(await readOwnedTemplate(ctx, "first")).toMatchObject({ content: "first", title: "Newer title" });
});

test("pstdio-planner rejects colliding legacy names before writing destination records", async () => {
  const storage = createMemoryStorage({
    legacyData: {
      templates: source([template("one", "same_name"), template("two", "same-name")]),
    },
  });
  const ctx = makeCommandContext({ storage, params: {} });
  await expect(readOwnedTemplate(ctx, "same-name")).rejects.toThrow("colliding");
  expect(await storage.collection("templates").list()).toEqual([]);
});

test("pstdio-planner preserves newer preferences and defaults during import", async () => {
  const storage = createMemoryStorage({
    legacyData: {
      extension_template_preferences: source([
        { template_key: "custom_template", enabled: true, display_name_override: "Old title" },
      ]),
      project_template_defaults: source([
        { template_type: "prompt", source: "extension_template", template_key: "old_default" },
      ]),
    },
  });
  await storage.collection("template-preferences").put("custom-template", {
    enabled: false,
    displayName: "New title",
  });
  await storage.set("template-defaults", { prompt: "new-default" });
  const ctx = makeCommandContext({ storage, params: {} });
  await readOwnedTemplate(ctx, "missing");
  expect(await storage.collection("template-preferences").get("custom-template")).toEqual({
    enabled: false,
    displayName: "New title",
  });
  expect(await storage.get<Record<string, string>>("template-defaults")).toEqual({ prompt: "new-default" });
});
