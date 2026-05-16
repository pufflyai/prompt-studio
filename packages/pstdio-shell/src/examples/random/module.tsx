import type { ShellModuleContribution } from "../../core";
import { defaultRandomShellModeId } from "./mock-data/data";
import { registerMailMode } from "./modules/mail-mode";
import { registerMusicMode } from "./modules/music-mode";
import { registerNotesMode } from "./modules/notes-mode";
import { registerRandomShellContributions } from "./modules/random-shell";

export const createRandomExampleModule = (): ShellModuleContribution => ({
  id: "random-example",
  activate(ctx) {
    registerRandomShellContributions(ctx);
    registerNotesMode(ctx);
    registerMailMode(ctx);
    registerMusicMode(ctx);
    ctx.modes.setActiveMode(defaultRandomShellModeId);
  },
});
