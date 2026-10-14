import {
  createDefaultWorkbenchLayout,
  type WorkbenchLayout,
  type WorkbenchWidgetPlacement,
} from "../../registries/layout/layout-types";
import { placementIdentityKey } from "../../registries/layout/placement-reconciliation";

export const createClosedPresetCache = (
  read: (scope?: string) => WorkbenchLayout | undefined,
  persist: (layout: WorkbenchLayout, scope?: string) => unknown,
) => ({
  forgetClosedPresets(scope: string | undefined, tabs: readonly WorkbenchWidgetPlacement[]) {
    const layout = read(scope);
    if (!layout?.closedPresets?.length) return;
    const closedPresets = layout.closedPresets.filter(
      (tab) =>
        !tabs.some(
          (open) =>
            open.placementIdentity &&
            tab.placementIdentity &&
            placementIdentityKey(open.placementIdentity) === placementIdentityKey(tab.placementIdentity) &&
            open.resourceKey === tab.resourceKey,
        ),
    );
    if (closedPresets.length !== layout.closedPresets.length) persist({ ...layout, closedPresets }, scope);
  },
  rememberClosedPreset(scope: string | undefined, tab: WorkbenchWidgetPlacement) {
    const layout = read(scope) ?? createDefaultWorkbenchLayout();
    const key = placementIdentityKey(tab.placementIdentity!);
    persist(
      {
        ...layout,
        closedPresets: [
          ...(layout.closedPresets ?? []).filter(
            (p) => p.placementIdentity && placementIdentityKey(p.placementIdentity) !== key,
          ),
          tab,
        ],
      },
      scope,
    );
  },
});
