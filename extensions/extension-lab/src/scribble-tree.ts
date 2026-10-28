import { defineView, l10n, params } from "@pstdio/sdk/extensions";
import { readExampleState } from "./example-state";
import { createScribblePage, updateScribblePageCommand } from "./scribble-commands";
import { filterScribbleDocuments, moveScribbleDocument } from "./scribble-pages-state";
import { readScribblePageEntries, updateScribblePageFields } from "./scribble-pages-storage";
import { scribbleDocumentPage, scribbleResource } from "./scribble-refs";
import { examplesChanged } from "./state-events";

export const scribbleTree = defineView({
  id: "scribble-pages",
  title: l10n("views.scribblePages", "Pages"),
  body: {
    kind: "tree",
    searchable: true,
    searchPlaceholder: l10n("scribble.searchPages", "Search pages"),
    refreshEvents: [examplesChanged],
    body: async (ctx, { filter }) => {
      const state = await readExampleState(ctx.storage, "scribble");
      return [
        {
          id: "workspace",
          label: l10n("scribble.workspace", "Workspace"),
          collapsible: false,
          emptyState: { title: l10n("scribble.emptySearch", "No pages found") },
          nodes: filterScribbleDocuments(state, filter).map((document) => ({
            id: document.id,
            label: document.title,
            icon: document.icon,
            canDrag: true,
            canDrop: true,
            contextMenuActions: [
              {
                id: "rename",
                label: l10n("scribble.renamePage", "Rename page"),
                icon: "pencil",
                command: updateScribblePageCommand.ref,
                params: { id: document.id },
                input: {
                  title: params.text({
                    required: true,
                    label: l10n("scribble.pageName", "Page name"),
                    defaultValue: document.title,
                  }),
                },
                submitLabel: "Rename",
              },
            ],
            resource: scribbleResource(document.id, document.title, ctx),
            target: {
              kind: "page" as const,
              page: scribbleDocumentPage,
              resource: scribbleResource(document.id, document.title, ctx),
              open: "pin" as const,
            },
          })),
        },
      ];
    },
    footer: async () => [
      {
        id: "actions",
        collapsible: false,
        nodes: [
          {
            id: "new-page",
            label: l10n("scribble.newPage", "New page"),
            icon: "plus",
            target: { kind: "command", target: { command: createScribblePage.ref } },
          },
        ],
      },
    ],
    onMove: async (ctx, { source, target, position }) => {
      const entries = await readScribblePageEntries(ctx.storage);
      const documents = moveScribbleDocument(
        entries.map((entry) => entry.document),
        source.id,
        target?.id,
        position,
      );
      const index = documents.findIndex((document) => document.id === source.id);
      const positions = new Map(entries.map((entry) => [entry.document.id, entry.position]));
      await updateScribblePageFields(ctx.storage, source.id, {
        position: ctx.storage.positions.between(
          positions.get(documents[index - 1]?.id),
          positions.get(documents[index + 1]?.id),
        ),
      });
      await ctx.events.emit(examplesChanged, { name: "scribble" });
    },
  },
});
