import { useEffect, useState } from "react";
import { createShellCore, type ShellCore, workbenchCommandPaletteMenuPath } from "../core";
import { ShellWorkbench } from "../react";
import {
  defaultRandomShellModeId,
  randomResourceKind,
  randomShellModeOrder,
  randomShellModes,
} from "./random-shell-example-data";
import { setupMailMode } from "./random-shell-mode-mail";
import { setupMusicMode } from "./random-shell-mode-music";
import { setupNotesMode } from "./random-shell-mode-notes";
import { registerRandomShellRail } from "./random-shell-rail";

const modeSetups = {
  notes: setupNotesMode,
  mail: setupMailMode,
  music: setupMusicMode,
} as const;

const openCommandPaletteCommandId = "random.openCommandPalette";
const openCommandPaletteKeybinding = "Meta+P";

const registerRandomResources = (shell: ShellCore) => {
  shell.resources.registerKind({ kind: randomResourceKind, label: "Item", icon: "FileText" });
};

const registerRandomModes = (shell: ShellCore) => {
  for (const modeId of randomShellModeOrder) {
    const mode = randomShellModes[modeId];
    const setup = modeSetups[modeId];
    shell.modes.registerMode({
      id: mode.id,
      label: mode.label,
      activate: (ctx) => setup(ctx),
    });
  }
};

const registerRandomCommands = (shell: ShellCore) => {
  shell.commands.registerCommand(
    {
      id: openCommandPaletteCommandId,
      label: "Show command palette",
      category: "Workbench",
      icon: "Search",
    },
    { execute: () => shell.commandPalette.open() },
  );
  shell.keybindings.registerKeybinding({
    commandId: openCommandPaletteCommandId,
    keybinding: openCommandPaletteKeybinding,
  });
  shell.menus.registerMenuAction(workbenchCommandPaletteMenuPath, {
    commandId: openCommandPaletteCommandId,
    order: 10,
  });

  for (const [index, modeId] of randomShellModeOrder.entries()) {
    const mode = randomShellModes[modeId];
    const commandId = `random.activateMode.${mode.id}`;
    shell.commands.registerCommand(
      {
        id: commandId,
        label: `Switch to ${mode.label}`,
        category: "Modes",
        icon: mode.topIcon,
      },
      { execute: () => shell.modes.setActiveMode(mode.id) },
    );
    shell.menus.registerMenuAction(workbenchCommandPaletteMenuPath, {
      commandId,
      order: 100 + index,
    });
  }
};

const matchesShortcut = (event: KeyboardEvent, binding: string) => {
  const parts = binding.split("+").map((part) => part.trim().toLowerCase());
  const key = parts[parts.length - 1];
  if (event.key.toLowerCase() !== key) return false;
  const wantMeta = parts.includes("meta");
  const wantCtrl = parts.includes("ctrl");
  const wantShift = parts.includes("shift");
  const wantAlt = parts.includes("alt");
  return (
    event.metaKey === wantMeta && event.ctrlKey === wantCtrl && event.shiftKey === wantShift && event.altKey === wantAlt
  );
};

const createRandomShellExample = () => {
  const shell = createShellCore();

  registerRandomResources(shell);
  registerRandomShellRail(shell);
  registerRandomModes(shell);
  registerRandomCommands(shell);
  shell.modes.setActiveMode(defaultRandomShellModeId);

  return { shell };
};

export const RandomShellExample = () => {
  const [example] = useState(createRandomShellExample);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!matchesShortcut(event, openCommandPaletteKeybinding)) return;
      event.preventDefault();
      example.shell.commandPalette.toggle();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [example.shell]);

  return <ShellWorkbench shell={example.shell} />;
};
