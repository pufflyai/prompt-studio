import type { WorkbenchModuleContribution } from "../../core";
import { defaultRandomWorkbenchModeId } from "./mock-data/data";
import { registerMailMode } from "./modules/mail-mode";
import { registerMusicMode } from "./modules/music-mode";
import { registerNotesMode } from "./modules/notes-mode";
import { registerRandomWorkbenchContributions } from "./modules/random-workbench";

export const createRandomExampleModule = (): WorkbenchModuleContribution => ({
  id: "random-example",
  activate(ctx) {
    registerRandomWorkbenchContributions(ctx);
    registerNotesMode(ctx);
    registerMailMode(ctx);
    registerMusicMode(ctx);
    ctx.modes.setActiveMode(defaultRandomWorkbenchModeId);
  },
});
