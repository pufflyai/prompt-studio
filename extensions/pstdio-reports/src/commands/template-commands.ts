import { defineCommand, params } from "@pstdio/sdk/extensions";
import {
  deleteReportTemplate,
  listReportTemplates,
  readReportTemplate,
  saveReportTemplate,
} from "../data/template-store";

export const listTemplateCommand = defineCommand({
  id: "templates.list",
  title: "List report templates",
  params: {},
  run: (ctx) => listReportTemplates(ctx),
});

export const readTemplateCommand = defineCommand({
  id: "templates.read",
  title: "Read report template",
  params: { name: params.text({ required: true }) },
  run: (ctx, input) => readReportTemplate(ctx, input.name),
});

export const saveTemplateCommand = defineCommand({
  id: "templates.save",
  title: "Save report template",
  mutating: true,
  params: {
    name: params.text({ required: true }),
    title: params.text(),
    content: params.markdown({ required: true }),
  },
  run: (ctx, input) => saveReportTemplate(ctx, input),
});

export const deleteTemplateCommand = defineCommand({
  id: "templates.delete",
  title: "Delete report template",
  mutating: true,
  params: { name: params.text({ required: true }) },
  run: async (ctx, input) => {
    await deleteReportTemplate(ctx, input.name);
    return { deleted: input.name };
  },
});

export const reportTemplateCommands = {
  list: listTemplateCommand,
  read: readTemplateCommand,
  save: saveTemplateCommand,
  delete: deleteTemplateCommand,
};
