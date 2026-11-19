import { defineView } from "@pstdio/sdk/extensions";
import { refresh } from "./commands";
import { changed } from "./resources";
import { catalogFiles, listCatalog } from "./template-catalog";
import { deleteTemplateRow, deleteTemplates, saveTemplate, viewTemplateRow } from "./template-commands";

export const catalogView = defineView({
  id: "catalog",
  title: "Template catalog",
  icon: "package",
  body: {
    kind: "dataTable",
    refreshEvents: [changed],
    emptyTitle: "No saved templates",
    emptyDescription: "Save a template manifest to launch instances and machines from it.",
    toolbarActions: [
      {
        id: "save",
        label: "Save template",
        icon: "file-plus",
        presentation: "primary",
        command: saveTemplate.ref,
        input: saveTemplate.params,
        submitLabel: "Save template",
      },
      { id: "refresh", label: "Refresh", icon: "refresh-cw", command: refresh.ref },
    ],
    columns: [
      { id: "name", label: "Template" },
      { id: "version", label: "Version" },
      { id: "description", label: "Description" },
      { id: "file", label: "File" },
      { id: "error", label: "Error" },
    ],
    selectionMode: "multiple",
    selectionActions: [
      { id: "remove", label: "Remove", icon: "trash-2", destructive: true, command: deleteTemplates.ref },
    ],
    rowActions: [
      { id: "view", label: "View template", icon: "file-json", command: viewTemplateRow.ref },
      { id: "remove", label: "Remove template", icon: "trash-2", destructive: true, command: deleteTemplateRow.ref },
    ],
    async onRowActivate(ctx, { row }) {
      await ctx.commands.execute(viewTemplateRow.ref, { params: { rowId: row.id } });
    },
    async query(ctx) {
      const entries = await listCatalog(catalogFiles(ctx));
      return {
        rows: entries.map(({ path, template, error }) => ({
          id: path,
          values: {
            name: template?.name ?? "",
            version: template?.version ?? "",
            description: template?.description ?? "",
            file: path.split("/").pop() ?? path,
            error,
          },
        })),
      };
    },
  },
});
