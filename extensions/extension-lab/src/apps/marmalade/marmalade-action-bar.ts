import { type ActionBarAction, defineView, l10n } from "@pstdio/sdk/extensions";
import type { MarmaladeAction } from "./marmalade.types";
import { executeMarmalade } from "./marmalade-commands";
import { marmaladeChanged } from "./marmalade-events";
import { inMarmaladeOrder, readMarmaladeDocument } from "./marmalade-storage";
import { marmaladeTools } from "./marmalade-tools";

const action = (input: MarmaladeAction) => ({
  kind: "command" as const,
  target: { command: executeMarmalade.ref, params: { action: input } },
});
export const marmaladeActionBar = defineView({
  id: "marmalade-rail",
  title: l10n("marmalade.tools.title", "Marmalade tools"),
  body: {
    kind: "actionBar",
    refreshEvents: [marmaladeChanged],
    query: (ctx) =>
      inMarmaladeOrder(ctx.projectId, async () => {
        const { state, history } = await readMarmaladeDocument(ctx.storage);
        const commands: ActionBarAction[] = [
          {
            id: "undo",
            label: l10n("marmalade.actions.undo", "Undo"),
            icon: "Undo",
            disabled: !history.past.length,
            action: action({ type: "undo" }),
          },
          {
            id: "redo",
            label: l10n("marmalade.actions.redo", "Redo"),
            icon: "Redo",
            disabled: !history.future.length,
            action: action({ type: "redo" }),
          },
          {
            id: "duplicate",
            label: l10n("marmalade.actions.duplicate", "Duplicate selection"),
            icon: "Copy",
            disabled: !state.selectedIds.length,
            action: action({ type: "duplicate" }),
          },
          {
            id: "new",
            label: l10n("marmalade.actions.new", "New document"),
            icon: "FilePlus",
            group: "document",
            action: action({ type: "empty" }),
          },
          {
            id: "reset",
            label: l10n("marmalade.actions.restore", "Restore sample"),
            icon: "RotateCcw",
            group: "document",
            action: action({ type: "reset" }),
          },
        ];
        return {
          items: [
            ...marmaladeTools.map((tool) => ({
              id: tool.id,
              label: tool.label,
              icon: tool.icon,
              selected: state.tool === tool.id,
              action: action({ type: "tool", tool: tool.id }),
            })),
            {
              id: "document",
              label: l10n("marmalade.actions.document", "Document actions"),
              icon: "Ellipsis",
              items: commands,
            },
          ],
        };
      }),
  },
});
