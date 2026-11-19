import { defineCommand, params } from "@pstdio/sdk/extensions";
import { catalogPageRef, templateTarget } from "./lab-navigation";
import { changed } from "./resources";
import {
  catalogFiles,
  listCatalog,
  parseCatalogTemplate,
  selectedTemplate,
  templateDirectory,
} from "./template-catalog";

export const saveTemplate = defineCommand({
  id: "templates.save",
  title: "Save agent template",
  cli: true,
  mutating: true,
  params: { source: params.longText({ label: "Template JSON or YAML", required: true }) },
  async run(ctx, input) {
    let source = input.source;
    if (!source.trim().startsWith("{")) source = JSON.stringify(Bun.YAML.parse(source));
    const template = parseCatalogTemplate("template.json", source);
    const path = `${templateDirectory}/${encodeURIComponent(template.name)}-${encodeURIComponent(template.version)}.json`;
    await catalogFiles(ctx).writeText(path, JSON.stringify(template.manifest, null, 2));
    await ctx.events.emit(changed, {});
    return { path, name: template.name, version: template.version };
  },
});

export const deleteTemplates = defineCommand({
  id: "templates.delete",
  title: "Remove catalog templates",
  cli: true,
  mutating: true,
  // A table selection sends the selected rows' IDs, which are catalog file paths.
  params: { rowIds: params.list({ label: "Template files", required: true }) },
  async run(ctx, input) {
    const files = catalogFiles(ctx);
    const listed = new Set((await listCatalog(files)).map((entry) => entry.path));
    if (!input.rowIds.every((path) => listed.has(path))) throw new Error("Choose listed templates.");
    for (const path of input.rowIds) await files.delete(path);
    await ctx.events.emit(changed, {});
    return { paths: input.rowIds };
  },
});

const rowParam = { rowId: params.text({ label: "Template file", required: true }) };

export const deleteTemplateRow = defineCommand({
  id: "templates.delete-row",
  title: "Remove template",
  mutating: true,
  params: rowParam,
  async run(ctx, input) {
    return deleteTemplates.run(ctx, { rowIds: [input.rowId] });
  },
});

export const viewTemplateRow = defineCommand({
  id: "templates.view-row",
  title: "View template",
  params: rowParam,
  async run(ctx, input) {
    await selectedTemplate(catalogFiles(ctx), input.rowId);
    ctx.navigation.open(templateTarget(ctx.projectId, input.rowId));
    return { path: input.rowId };
  },
});

export const openCatalog = defineCommand({
  id: "templates.open-catalog",
  title: "Open template catalog",
  async run(ctx) {
    ctx.navigation.open({ kind: "page", page: catalogPageRef });
    return {};
  },
});
