import type { WorkbenchLayout } from "../../registries/layout/layout-types";

/** Selecting an existing Main view changes its context without replacing the tray. */
export const selectedMainLayout = (current: WorkbenchLayout, destination: WorkbenchLayout | undefined) => {
  const base = destination ?? current;
  return {
    ...base,
    regions: {
      ...base.regions,
      main: {
        ...current.regions.main,
        headerVisible: destination?.regions.main.headerVisible,
      },
    },
  };
};
