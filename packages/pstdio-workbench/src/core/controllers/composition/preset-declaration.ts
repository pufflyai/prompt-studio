import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import { pagePlacementDeclarations } from "../../registries/pages/page-main";
import type { WorkbenchCore } from "../../workbench-core-types";

export const presetDeclaration = (core: WorkbenchCore, identity: PlacementIdentity) => {
  if (identity.kind === "mode")
    return core.modePlacements.listPlacements(identity.modeId).find((p) => p.id === identity.placementId);
  if (identity.kind === "shell") return core.shellPlacements.getPlacement(identity.placementId);
  const page = core.pages.getPage(identity.pageId);
  return page && pagePlacementDeclarations(page).find((p) => p.id === identity.slotId);
};
