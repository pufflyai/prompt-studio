import type { useNavigate } from "@tanstack/react-router";
import type { CommandPaletteAction } from "./command-palette-model";

interface CommandPaletteActionContext {
  projectId: string;
  navigate: ReturnType<typeof useNavigate>;
  beginThemePreview: () => void;
  commitThemePreview: (preference: Extract<CommandPaletteAction, { type: "theme" }>["preference"]) => void;
  closePalette: () => void;
  requestCreateTicket: () => void;
  createSession: () => void;
  openShortcutHelp: () => void;
  runExtensionCommand: (commandId: string) => void;
}

export const runCommandPaletteAction = (action: CommandPaletteAction, ctx: CommandPaletteActionContext) => {
  if (action.type === "open-theme-menu") {
    ctx.beginThemePreview();
    return;
  }

  if (action.type === "theme") {
    ctx.commitThemePreview(action.preference);
    return;
  }

  ctx.closePalette();

  if (action.type === "navigate") {
    ctx.navigate({ to: action.path });
    return;
  }

  if (action.type === "create-ticket") {
    ctx.requestCreateTicket();
    ctx.navigate({ to: `/projects/${ctx.projectId}/tickets` });
    return;
  }

  if (action.type === "create-session") {
    ctx.createSession();
    return;
  }

  if (action.type === "open-shortcut-help") {
    ctx.openShortcutHelp();
    return;
  }

  if (action.type === "extension-command") {
    ctx.runExtensionCommand(action.commandId);
    return;
  }
};
