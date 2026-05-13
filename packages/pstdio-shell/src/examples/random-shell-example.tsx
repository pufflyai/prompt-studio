import { useState } from "react";
import { createShellCore, type ShellCore } from "../core";
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

const createRandomShellExample = () => {
  const shell = createShellCore();

  registerRandomResources(shell);
  registerRandomShellRail(shell);
  registerRandomModes(shell);
  shell.modes.setActiveMode(defaultRandomShellModeId);

  return { shell };
};

export const RandomShellExample = () => {
  const [example] = useState(createRandomShellExample);

  return <ShellWorkbench shell={example.shell} />;
};
