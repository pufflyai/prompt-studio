import { defineKeybinding, type ViewRef } from "@pstdio/sdk/extensions";
import type { MarmaladeAction } from "./marmalade.types";
import { executeMarmalade } from "./marmalade-commands";
import { marmaladeTools } from "./marmalade-tools";

const actions: readonly (readonly [string, MarmaladeAction])[] = [
  ...marmaladeTools.map(({ key, id }) => [key, { type: "tool", tool: id }] as const),
  ["Mod+Z", { type: "undo" }],
  ["Mod+Shift+Z", { type: "redo" }],
  ["Mod+D", { type: "duplicate" }],
  ["Mod+G", { type: "group" }],
  ["Mod+Shift+G", { type: "ungroup" }],
  ["Delete", { type: "delete" }],
];

export const marmaladeShortcuts = (views: ViewRef[], canvas: ViewRef) =>
  actions.map(([key, action]) =>
    defineKeybinding({
      id: action.type === "tool" ? `marmalade-tool-${action.tool}` : `marmalade-${action.type}`,
      key,
      // Single-letter tool keys type text, so they live in shortcut mode; modifier chords stay direct.
      // Tools act on the canvas only, so the inspector beside it never adds a second target to choose.
      ...(action.type === "tool" ? { layer: "current" as const } : {}),
      when: { view: action.type === "tool" ? [canvas] : views },
      action: { kind: "command", target: { command: executeMarmalade.ref, params: { action } } },
    }),
  );
