import { expect, test } from "bun:test";
import type { JsonObject } from "@pstdio/sdk/extensions";
import { createMemoryStorage, createMemoryStorageDevices } from "@pstdio/sdk/testing";
import { makeCommandContext } from "../commands/command-context.fixture";
import { listReportTemplates, readReportTemplate } from "./template-store";

const source = (records: JsonObject[]) => ({ version: "0027-before-removal", records });
const template = (id: string, name: string, type = "report") => ({
  id,
  project_id: "proj-1",
  name,
  template_type: type,
  file_id: id,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
  deleted_at: null,
});

test("two offline report template imports converge on one record per source template", async () => {
  const pair = await createMemoryStorageDevices({
    extensionId: "pstdio.pstdio-reports",
    legacyData: { templates: source([template("source-file", "custom_report")]) },
  });
  for (const storage of pair.devices) {
    const ctx = makeCommandContext({ storage, params: {}, overrides: { files: { readText: async () => "Imported" } } });
    await readReportTemplate(ctx, "custom-report");
    await readReportTemplate(ctx, "custom-report");
    expect(await storage.collection("templates").list()).toHaveLength(1);
  }
  await pair.merge();
  const keys = await Promise.all(
    pair.devices.map(async (storage) => (await storage.records.list()).map((record) => record.recordId).sort()),
  );
  expect(keys[0]).toEqual(keys[1]);
  for (const storage of pair.devices) expect(await storage.collection("templates").list()).toHaveLength(1);
});

test("pstdio-reports imports its old content, preferences, and defaults through public storage", async () => {
  const storage = createMemoryStorage({
    legacyData: {
      templates: source([template("file", "custom_template"), template("other", "other_owner", "prompt")]),
      extension_template_preferences: source([
        {
          template_key: "custom_template",
          enabled: true,
          display_name_override: "Preferred",
          metadata_json: { pinned: true },
        },
      ]),
      project_template_defaults: source([{ template_type: "report", source: "project_template", template_id: "file" }]),
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
  expect(await readReportTemplate(ctx, "custom-template")).toMatchObject({
    content: "Original content",
    title: "Preferred",
    type: "report",
  });
  expect((await listReportTemplates(ctx))[0].name).toBe("custom-template");
  expect(await storage.get<Record<string, string>>("template-defaults")).toEqual({ report: "custom-template" });
  expect(await readReportTemplate(ctx, "custom-template")).toMatchObject({ content: "Original content" });
  expect(reads).toBe(1);
  expect(await storage.collection("templates").get("other-owner")).toBeUndefined();
});

test("pstdio-reports retries an interrupted import and preserves newer extension records", async () => {
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
  await expect(readReportTemplate(ctx, "second")).rejects.toThrow("Source unavailable");
  const first = await storage.collection<Record<string, unknown>>("templates").get("first");
  await storage.collection("templates").put("first", { ...first, title: "Newer title" });
  interrupted = false;
  expect(await readReportTemplate(ctx, "second")).toMatchObject({ content: "second" });
  expect(await readReportTemplate(ctx, "first")).toMatchObject({ content: "first", title: "Newer title" });
});

test("pstdio-reports rejects colliding legacy names before writing destination records", async () => {
  const storage = createMemoryStorage({
    legacyData: {
      templates: source([template("one", "same_name"), template("two", "same-name")]),
    },
  });
  const ctx = makeCommandContext({ storage, params: {} });
  await expect(readReportTemplate(ctx, "same-name")).rejects.toThrow("colliding");
  expect(await storage.collection("templates").list()).toEqual([]);
});

test("pstdio-reports preserves newer preferences and defaults during import", async () => {
  const storage = createMemoryStorage({
    legacyData: {
      extension_template_preferences: source([
        { template_key: "custom_template", enabled: true, display_name_override: "Old title" },
      ]),
      project_template_defaults: source([
        { template_type: "report", source: "extension_template", template_key: "old_default" },
      ]),
    },
  });
  await storage.collection("template-preferences").put("custom-template", {
    enabled: false,
    displayName: "New title",
  });
  await storage.set("template-defaults", { report: "new-default" });
  const ctx = makeCommandContext({ storage, params: {} });
  await readReportTemplate(ctx, "missing");
  expect(await storage.collection("template-preferences").get("custom-template")).toEqual({
    enabled: false,
    displayName: "New title",
  });
  expect(await storage.get<Record<string, string>>("template-defaults")).toEqual({ report: "new-default" });
});
