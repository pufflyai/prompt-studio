import { pageSlots } from "../../registries/pages/page-main";
import { modePlacementContributionId, pagePlacementContributionId } from "../../registries/views/view-placement";
import type { WorkbenchCore } from "../../workbench-core-types";
import { openOwnerLayouts } from "../page-runtime/open-owner-layouts";
import { resetOwnerScope } from "./reset-preset-bindings";
import { createResetPresetNavigation } from "./reset-preset-navigation";

export const resetMissingPresets = async (core: WorkbenchCore, owner: "page" | "mode") => {
  const scope = resetOwnerScope(core, owner);
  const openPreset = createResetPresetNavigation(core, owner);
  const state = core.pages.store.getState();
  const page = state.activePageId ? state.pages[state.activePageId] : undefined;
  const pageDeclarations = page
    ? pageSlots(page).map((slot) => ({ ...slot, panelId: pagePlacementContributionId(page.id, slot.id) }))
    : [];
  const modeDeclarations = core.modePlacements
    .listPlacements(state.activeModeId ?? core.modes.getActiveModeId())
    .map((p) => ({ ...p, panelId: modePlacementContributionId(p.id) }));
  // Resolve availability before commands can navigate away from the initiating owner.
  const declarations = (owner === "page" ? pageDeclarations : modeDeclarations).filter((declaration) =>
    core.composition
      .panelsFor(declaration.region as "main" | "side" | "secondary" | "aside" | "bottom")
      .addable.some((panel) => panel.panelId === declaration.panelId),
  );
  for (const declaration of declarations) {
    if (core.pages.store.getState().projectId !== state.projectId) return;
    if (
      declaration.item.kind !== "binding" ||
      declaration.item.binding.cardinality !== "one" ||
      !declaration.item.binding.add
    )
      continue;
    const open = openOwnerLayouts(core).flatMap(({ layout, scope }) =>
      Object.values(layout.regions).flatMap((r) => r.widgets.map((tab) => ({ tab, scope }))),
    );
    if (
      open.some(
        ({ tab, scope: layoutScope }) =>
          tab.contributionId === declaration.panelId &&
          (owner === "mode" || (tab.declarationScope ?? layoutScope) === scope),
      )
    )
      continue;
    await openPreset(declaration.item.binding.add);
  }
};
