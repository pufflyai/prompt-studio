import type { LayoutModel } from "./layout-model-types";
import type { WorkbenchLayout, WorkbenchRegion, WorkbenchRegionState } from "./layout-types";

export interface CreateLayoutRegionMethodsInput {
  getLayout(): WorkbenchLayout;
  setLayout(layout: WorkbenchLayout): void;
  persistLayout(): void;
}

// Region state edits share one write-and-persist path, so a region change is one layout change.
export const createLayoutRegionMethods = (
  input: CreateLayoutRegionMethodsInput,
): Pick<LayoutModel, "setRegionVisible" | "setRegionSize" | "setSidePanelMode"> => {
  const updateRegion = (regionId: WorkbenchRegion, update: (region: WorkbenchRegionState) => WorkbenchRegionState) => {
    const layout = input.getLayout();
    const region = layout.regions[regionId];
    const nextRegion = update(region);
    if (nextRegion === region) return;
    input.setLayout({ ...layout, regions: { ...layout.regions, [regionId]: nextRegion } });
    input.persistLayout();
  };

  return {
    setRegionVisible(regionId, visible) {
      updateRegion(regionId, (region) => (region.visible === visible ? region : { ...region, visible }));
    },

    setRegionSize(regionId, size) {
      updateRegion(regionId, (region) => (region.size === size ? region : { ...region, size }));
    },

    setSidePanelMode(mode) {
      updateRegion("side", (region) => {
        if (mode === "closed") return region.visible ? { ...region, visible: false } : region;
        return region.visible && region.presentation === mode
          ? region
          : { ...region, visible: true, presentation: mode };
      });
    },
  };
};
