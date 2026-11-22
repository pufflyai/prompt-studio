import { defineView, l10n } from "@pstdio/sdk/extensions";
import { refresh } from "./commands";
import { changed } from "./resources";
import { catalogFiles, listCatalog } from "./template-catalog";
import { deleteTemplateRow, deleteTemplates, saveTemplate, viewTemplateRow } from "./template-commands";

export const catalogView = defineView({
  id: "catalog",
  title: l10n("cloud-workspaces.template-catalog", "Template catalog"),
  icon: "package",
  body: {
    kind: "dataTable",
    refreshEvents: [changed],
    emptyTitle: l10n("cloud-workspaces.no-saved-templates", "No saved templates"),
    emptyDescription: l10n(
      "cloud-workspaces.save-a-template-manifest-to-launch-instances-and-machines-from-it",
      "Save a template manifest to launch instances and machines from it.",
    ),
    toolbarActions: [
      {
        id: "save",
        label: l10n("cloud-workspaces.save-template", "Save template"),
        icon: "file-plus",
        presentation: "primary",
        command: saveTemplate.ref,
        input: saveTemplate.params,
        submitLabel: "Save template",
      },
      { id: "refresh", label: l10n("cloud-workspaces.refresh", "Refresh"), icon: "refresh-cw", command: refresh.ref },
    ],
    columns: [
      { id: "name", label: l10n("cloud-workspaces.template", "Template") },
      { id: "version", label: l10n("cloud-workspaces.version", "Version") },
      { id: "description", label: l10n("cloud-workspaces.description", "Description") },
      { id: "file", label: l10n("cloud-workspaces.file", "File") },
      { id: "error", label: l10n("cloud-workspaces.error", "Error") },
    ],
    selectionMode: "multiple",
    selectionActions: [
      {
        id: "remove",
        label: l10n("cloud-workspaces.remove", "Remove"),
        icon: "trash-2",
        destructive: true,
        command: deleteTemplates.ref,
      },
    ],
    rowActions: [
      {
        id: "view",
        label: l10n("cloud-workspaces.view-template", "View template"),
        icon: "file-json",
        command: viewTemplateRow.ref,
      },
      {
        id: "remove",
        label: l10n("cloud-workspaces.remove-template", "Remove template"),
        icon: "trash-2",
        destructive: true,
        command: deleteTemplateRow.ref,
      },
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
