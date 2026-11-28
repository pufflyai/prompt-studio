import {
  defineCommand,
  type EditorSelectionContext,
  editorSlots,
  l10n,
  workbenchCommands,
} from "@pstdio/sdk/extensions";

export const askAgent = defineCommand({
  id: "ask-about-selection",
  title: l10n("commands.askAgent", "Ask agent"),
  menus: [{ slot: editorSlots.selection, icon: "sparkles" }],
  run(ctx) {
    const slot = ctx.slot;
    if (slot?.id !== editorSlots.selection.id) throw new Error("Select a passage in an editor first.");
    const selection = (slot.context as Partial<EditorSelectionContext>).selection;
    if (!selection || typeof selection.text !== "string" || !selection.text.trim() || selection.text.length > 10000)
      throw new Error("Select a passage in an editor first.");
    const resource = ctx.resource;
    const location = selection.documentPath ?? resource?.label ?? resource?.id ?? "Document";
    const text = [
      `About this passage in ${location}:`,
      ...selection.text.split("\n").map((line) => `> ${line}`),
      "",
    ].join("\n");
    ctx.navigation.open({
      kind: "command",
      target: { command: workbenchCommands.openSessionDraft, params: { text, label: "Ask agent" } },
    });
  },
});
