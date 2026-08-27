import { defineCommand, params } from "@pstdio/sdk/extensions";
import { deleteOwnedTemplate, listOwnedTemplates, readOwnedTemplate, saveOwnedTemplate } from "../data/template-store";

export const listTemplatesCommand = defineCommand({
  id: "templates.list",
  title: "List templates",
  params: { type: params.text() },
  async run(ctx, commandParams) {
    return listOwnedTemplates(ctx, commandParams.type);
  },
});

export const readTemplateCommand = defineCommand({
  id: "templates.read",
  title: "Read template",
  params: { name: params.text({ required: true }) },
  async run(ctx, commandParams) {
    return readOwnedTemplate(ctx, commandParams.name);
  },
});

export const saveTemplateCommand = defineCommand({
  id: "templates.save",
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
  title: "Delete template",
  mutating: true,
  params: { name: params.text({ required: true }) },
  async run(ctx, commandParams) {
    await deleteOwnedTemplate(ctx, commandParams.name);
    return { deleted: true };
  },
});

export const templateCommands = {
  list: listTemplatesCommand,
  read: readTemplateCommand,
  save: saveTemplateCommand,
  delete: deleteTemplateCommand,
};
