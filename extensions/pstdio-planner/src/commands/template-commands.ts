import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import {
  deleteOwnedTemplate,
  listOwnedTemplates,
  readOwnedTemplate,
  resetOwnedTemplate,
  saveOwnedTemplate,
} from "../data/template-store";

export const listTemplatesCommand = defineCommand({
  id: "templates.list",
  cli: true,
  title: "List templates",
  params: { type: params.text() },
  async run(ctx, commandParams) {
    return listOwnedTemplates(ctx, commandParams.type);
  },
});

export const readTemplateCommand = defineCommand({
  id: "templates.read",
  cli: true,
  title: "Read template",
  params: { name: params.text({ required: true }) },
  async run(ctx, commandParams) {
    return readOwnedTemplate(ctx, commandParams.name);
  },
});

export const saveTemplateCommand = defineCommand({
  id: "templates.save",
  cli: true,
  title: "Save template",
  mutating: true,
  params: {
    name: params.text({ required: true }),
    title: params.text(),
    type: params.text({ required: true }),
    content: params.longText({ required: true }),
  },
  async run(ctx, commandParams) {
    return saveOwnedTemplate(ctx, commandParams);
  },
});

export const deleteTemplateCommand = defineCommand({
  id: "templates.delete",
  cli: true,
  title: "Delete template",
  mutating: true,
  params: { name: params.text({ required: true }) },
  async run(ctx, commandParams) {
    await deleteOwnedTemplate(ctx, commandParams.name);
    return { deleted: true };
  },
});

export const resetTemplateCommand = defineCommand({
  id: "templates.reset",
  title: l10n("commands.templates.reset.title", "Restore package template"),
  cli: true,
  mutating: true,
  params: { name: params.text({ required: true }) },
  async run(ctx, { name }) {
    return resetOwnedTemplate(ctx, name);
  },
});

export const templateCommands = {
  list: listTemplatesCommand,
  read: readTemplateCommand,
  save: saveTemplateCommand,
  delete: deleteTemplateCommand,
  reset: resetTemplateCommand,
};
