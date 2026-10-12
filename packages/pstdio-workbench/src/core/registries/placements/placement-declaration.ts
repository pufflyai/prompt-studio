import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import type { WorkbenchCore } from "../../workbench-core-types";
import { pagePlacementDeclarations } from "../pages/page-main";

export const hasPlacementDeclaration = (
  core: Pick<WorkbenchCore, "pages" | "modePlacements" | "shellPlacements">,
  identity: PlacementIdentity,
) => {
  if (identity.kind === "mode") return core.modePlacements.listPlacements().some((p) => p.id === identity.placementId);
  if (identity.kind === "shell") return Boolean(core.shellPlacements.getPlacement(identity.placementId));
  const page = core.pages.getPage(identity.pageId);
  return Boolean(page && pagePlacementDeclarations(page).some((slot) => slot.id === identity.slotId));
};
