import type { WorkbenchCore } from "../../core";

export const registerBoomboxPlacements = (workbench: WorkbenchCore) => {
  workbench.modePlacements.registerPlacement({
    id: "boombox.up-next",
    ref: { extensionId: "storybook.showcases", kind: "placement", id: "boombox.up-next" },
    modeId: "boombox",
    region: "side",
    item: { kind: "view", presence: "open", view: { kind: "view", id: "boombox.up-next" } },
  });
  workbench.modePlacements.registerPlacement({
    id: "boombox.player",
    ref: { extensionId: "storybook.showcases", kind: "placement", id: "boombox.player" },
    modeId: "boombox",
    region: "secondary",
    item: {
      kind: "view",
      presence: "open",
      view: {
        kind: "view",
        id: "boombox.player",
      },
    },
  });
};
