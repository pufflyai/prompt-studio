import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { placementIdentityKey } from "../../registries/layout/placement-reconciliation";
import type { WorkbenchCore } from "../../workbench-core-types";
import { rememberClosedOwnerPreset } from "../page-runtime/open-owner-layouts";
import { modeLayoutScope } from "../page-runtime/owner-layout-scope";
import { presetDeclaration } from "./preset-declaration";

/** A closed preset keeps its binding with the declaring owner, even after a transfer. */
export const rememberClosedPreset = (core: WorkbenchCore, placement: WorkbenchWidgetPlacement) => {
  const identity = placement.declarationIdentity ?? placement.placementIdentity;
  if (!identity) return;
  const declaration = presetDeclaration(core, identity);
  if (!declaration || (declaration.item.kind === "binding" && declaration.item.binding.cardinality !== "one")) return;
  const scope =
    placement.declarationScope ??
    (identity.kind === "mode"
      ? modeLayoutScope(core.pages.store.getState().projectId, identity.modeId)
      : core.layout.getPersistenceScope());
  const { declarationIdentity: _origin, declarationScope: _scope, ...value } = placement;
  const tab = { ...value, placementIdentity: identity };
  if (scope === core.layout.getPersistenceScope()) {
    const layout = core.layout.getLayout();
    const key = placementIdentityKey(identity);
    core.layout.restoreLayout({
      ...layout,
      closedPresets: [
        ...(layout.closedPresets ?? []).filter(
          (p) => p.placementIdentity && placementIdentityKey(p.placementIdentity) !== key,
        ),
        tab,
      ],
    });
  } else rememberClosedOwnerPreset(core, scope, tab);
};
