import type React from "react";
import { type CommandPaletteView, resolveCommandPaletteEscapeAction } from "./command-palette-model";

interface CommandPaletteKeyboardContext {
  query: string;
  view: CommandPaletteView;
  entryCount: number;
  setActiveIndex: React.Dispatch<React.SetStateAction<number>>;
  setQuery: (query: string) => void;
  runActiveEntry: () => void;
  exitThemePreview: () => void;
  closePalette: () => void;
}

export const handleCommandPaletteKeyDown = (
  event: React.KeyboardEvent<HTMLInputElement>,
  ctx: CommandPaletteKeyboardContext,
) => {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    ctx.setActiveIndex((current) => Math.min(current + 1, ctx.entryCount - 1));
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    ctx.setActiveIndex((current) => Math.max(current - 1, 0));
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    ctx.runActiveEntry();
    return;
  }

  if (event.key !== "Escape") return;

  event.preventDefault();
  event.stopPropagation();

  const escapeAction = resolveCommandPaletteEscapeAction(ctx.query, ctx.view);

  if (escapeAction === "clear") {
    ctx.setQuery("");
    ctx.setActiveIndex(0);
    return;
  }

  if (escapeAction === "exit-view") {
    ctx.exitThemePreview();
    return;
  }

  ctx.closePalette();
};
