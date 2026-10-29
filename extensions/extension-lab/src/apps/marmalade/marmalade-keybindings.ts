import { defineCommand, defineKeybinding, l10n, type ModeRef } from "@pstdio/sdk/extensions";
import type { MarmaladeAction } from "./marmalade.types";
import { editMarmalade } from "./marmalade-commands";

const actions: { id: string; title: string; key: string; action: MarmaladeAction }[] = [
  { id: "move", title: "Move tool", key: "V", action: { type: "tool", tool: "move" } },
  { id: "text", title: "Text tool", key: "T", action: { type: "tool", tool: "text" } },
  { id: "rectangle", title: "Rectangle tool", key: "R", action: { type: "tool", tool: "rectangle" } },
  { id: "ellipse", title: "Ellipse tool", key: "E", action: { type: "tool", tool: "ellipse" } },
  { id: "brush", title: "Brush tool", key: "B", action: { type: "tool", tool: "brush" } },
  { id: "hand", title: "Hand tool", key: "H", action: { type: "tool", tool: "hand" } },
  { id: "zoom", title: "Zoom tool", key: "Z", action: { type: "tool", tool: "zoom" } },
  { id: "undo", title: "Undo document edit", key: "Mod+Z", action: { type: "undo" } },
  { id: "redo", title: "Redo document edit", key: "Mod+Shift+Z", action: { type: "redo" } },
  { id: "duplicate", title: "Duplicate layers", key: "Mod+D", action: { type: "duplicate" } },
  { id: "group", title: "Group layers", key: "Mod+G", action: { type: "group" } },
  { id: "ungroup", title: "Ungroup layers", key: "Mod+Shift+G", action: { type: "ungroup" } },
  { id: "delete", title: "Delete layers", key: "Delete", action: { type: "delete" } },
];

export const marmaladeKeyboardActions = (mode: ModeRef) => {
  const commands = actions.map((entry) =>
    defineCommand({
      id: `marmalade.${entry.id}`,
      title: l10n(`commands.marmalade.${entry.id}`, entry.title),
      cli: { path: ["marmalade", entry.id] },
      mutating: true,
      run: (ctx) => editMarmalade.run(ctx, { action: entry.action }),
    }),
  );
  const keybindings = actions.map((entry, index) =>
    defineKeybinding({
      id: `marmalade.${entry.id}`,
      key: entry.key,
      ...(entry.id === "redo" && { win: "Ctrl+Y" }),
      ...(entry.id === "delete" && { mac: "Backspace" }),
      when: { mode },
      action: { kind: "command", target: { command: commands[index]!.ref } },
    }),
  );
  return { commands, keybindings };
};
