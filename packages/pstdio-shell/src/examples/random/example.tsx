import type { ShellCore } from "../../core";
import { defaultRandomShellModeId } from "./mock-data/data";
import { activateMailMode } from "./modules/mail-mode";
import { activateMusicMode } from "./modules/music-mode";
import { activateNotesMode } from "./modules/notes-mode";
import { activateRandomShellModule } from "./modules/random-shell";

export const activateRandomExample = (shell: ShellCore) => {
  activateRandomShellModule(shell);
  activateNotesMode(shell);
  activateMailMode(shell);
  activateMusicMode(shell);
  shell.modes.setActiveMode(defaultRandomShellModeId);
};
