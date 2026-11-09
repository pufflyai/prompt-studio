import type { MarmaladeAction, MarmaladeTool } from "./marmalade.types";

const shortcut = (event: KeyboardEvent) => {
  const key = event.key.toLowerCase();
  if (event.ctrlKey || event.metaKey) {
    const commands: Record<string, MarmaladeAction> = {
      z: { type: event.shiftKey ? "redo" : "undo" },
      y: { type: "redo" },
      d: { type: "duplicate" },
      g: { type: event.shiftKey ? "ungroup" : "group" },
    };
    return commands[key];
  }
  if (event.altKey) return;
  if (key === "delete" || key === "backspace") return { type: "delete" } as const;
  const tools: Record<string, MarmaladeTool> = {
    v: "move",
    t: "text",
    r: "rectangle",
    e: "ellipse",
    b: "brush",
    h: "hand",
    z: "zoom",
  };
  if (tools[key]) return { type: "tool", tool: tools[key] } as const;
};
export const connectMarmaladeShortcuts = (dispatch: (action: MarmaladeAction) => Promise<void>) => {
  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target;
    if (target instanceof Element && target.closest("input, textarea, select, [contenteditable=true], [role=combobox]"))
      return;
    const action = shortcut(event);
    if (!action) return;
    event.preventDefault();
    void dispatch(action);
  };
  document.addEventListener("keydown", onKeyDown);
  return () => document.removeEventListener("keydown", onKeyDown);
};
