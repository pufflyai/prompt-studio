import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";
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
  title: l10n("cloud-workspaces.save-agent-template", "Save agent template"),
  cli: true,
  mutating: true,
  params: {
    source: params.longText({
      label: l10n("cloud-workspaces.template-json-or-yaml", "Template JSON or YAML"),
      required: true,
    }),
  },
  async run(ctx, input) {
    let manifest: unknown;
    try {
      manifest = JSON.parse(input.source);
    } catch {
      manifest = Bun.YAML.parse(input.source);
    }
    const template = parseCatalogTemplate("template.json", JSON.stringify(manifest));
    const files = catalogFiles(ctx);
    const entries = await listCatalog(files);
    const existing = entries.find(
      (entry) => entry.template?.name === template.name && entry.template.version === template.version,
    );
    const path =
      existing?.path ??
      `${templateDirectory}/identities/${encodeURIComponent(JSON.stringify([template.name, template.version]))}.json`;
    if (!existing && entries.some((entry) => entry.path === path))
      throw new Error("A different template already occupies this file. Move that file before saving this identity.");
    await files.writeText(path, JSON.stringify(template.manifest, null, 2));
    await ctx.events.emit(changed, {});
    return { path, name: template.name, version: template.version };
  },
});

export const deleteTemplates = defineCommand({
  id: "templates.delete",
  title: l10n("cloud-workspaces.remove-catalog-templates", "Remove catalog templates"),
  cli: true,
  mutating: true,
  // A table selection sends the selected rows' IDs, which are catalog file paths.
  params: { rowIds: params.list({ label: l10n("cloud-workspaces.template-files", "Template files"), required: true }) },
  async run(ctx, input) {
    const files = catalogFiles(ctx);
    const listed = new Set((await listCatalog(files)).map((entry) => entry.path));
    if (!input.rowIds.every((path) => listed.has(path))) throw new Error("Choose listed templates.");
    for (const path of input.rowIds) await files.delete(path);
    await ctx.events.emit(changed, {});
    return { paths: input.rowIds };
  },
});

const rowParam = {
  rowId: params.text({ label: l10n("cloud-workspaces.template-file", "Template file"), required: true }),
};

export const deleteTemplateRow = defineCommand({
  id: "templates.delete-row",
  title: l10n("cloud-workspaces.remove-template", "Remove template"),
  mutating: true,
  params: rowParam,
  async run(ctx, input) {
    return deleteTemplates.run(ctx, { rowIds: [input.rowId] });
  },
});

export const viewTemplateRow = defineCommand({
  id: "templates.view-row",
  title: l10n("cloud-workspaces.view-template", "View template"),
  params: rowParam,
  async run(ctx, input) {
    await selectedTemplate(catalogFiles(ctx), input.rowId);
    ctx.navigation.open(templateTarget(ctx.projectId, input.rowId));
    return { path: input.rowId };
  },
});

export const openCatalog = defineCommand({
  id: "templates.open-catalog",
  title: l10n("cloud-workspaces.open-template-catalog", "Open template catalog"),
  async run(ctx) {
    ctx.navigation.open({ kind: "page", page: catalogPageRef });
    return {};
  },
});
