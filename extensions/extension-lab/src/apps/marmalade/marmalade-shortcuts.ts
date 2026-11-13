import { defineKeybinding, type ViewRef } from "@pstdio/sdk/extensions";
import type { MarmaladeAction, MarmaladeTool } from "./marmalade.types";
import { executeMarmalade } from "./marmalade-commands";

const tools: [string, MarmaladeTool][] = [
  ["V", "move"],
  ["T", "text"],
  ["R", "rectangle"],
  ["E", "ellipse"],
  ["B", "brush"],
  ["H", "hand"],
  ["Z", "zoom"],
];
const actions: readonly (readonly [string, MarmaladeAction])[] = [
  ...tools.map(([key, tool]) => [key, { type: "tool", tool }] as const),
  ["Mod+Z", { type: "undo" }],
  ["Mod+Shift+Z", { type: "redo" }],
  ["Mod+D", { type: "duplicate" }],
  ["Mod+G", { type: "group" }],
  ["Mod+Shift+G", { type: "ungroup" }],
  ["Delete", { type: "delete" }],
];

export const marmaladeShortcuts = (views: ViewRef[]) =>
  actions.map(([key, action]) =>
    defineKeybinding({
      id: action.type === "tool" ? `marmalade-tool-${action.tool}` : `marmalade-${action.type}`,
      key,
      when: { view: views },
      action: { kind: "command", target: { command: executeMarmalade.ref, params: { action } } },
    }),
  );
