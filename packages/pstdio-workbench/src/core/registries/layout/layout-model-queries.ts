import { getActivePlacement } from "./layout-operations";
import type {
  RegisteredPlaceholderContribution,
  WorkbenchArea,
  WorkbenchAreaState,
  WorkbenchLayout,
  WorkbenchLayoutStoreState,
} from "./layout-types";

interface CreateAreaQueriesInput {
  getLayout(): WorkbenchLayout;
  getWidgets(): WorkbenchLayoutStoreState["widgets"];
  getPlaceholder(areaId: WorkbenchArea): RegisteredPlaceholderContribution | undefined;
  requireArea(areaId: WorkbenchArea): WorkbenchAreaState;
}

export const createAreaQueries = (input: CreateAreaQueriesInput) => {
  const { getLayout, getWidgets, getPlaceholder, requireArea } = input;

  return {
    getAreaSize(areaId: WorkbenchArea) {
      const area = requireArea(areaId);
      const persistedSize = getLayout().nodes[areaId]?.size;
      const placement = getActivePlacement(area);
      const contributionSize = placement
        ? getWidgets()[placement.contributionId]?.areaSize
        : getPlaceholder(areaId)?.areaSize;
      if (persistedSize === undefined) return contributionSize;
      return { ...contributionSize, defaultPx: persistedSize };
    },

    getAreaCollapsible(areaId: WorkbenchArea) {
      const placement = getActivePlacement(requireArea(areaId));
      if (!placement) return getPlaceholder(areaId)?.areaCollapsible ?? true;
      return getWidgets()[placement.contributionId]?.areaCollapsible ?? true;
    },

    getAreaHeaderBorderBottom(areaId: WorkbenchArea) {
      const placement = getActivePlacement(requireArea(areaId));
      if (!placement) return true;
      return getWidgets()[placement.contributionId]?.headerBorderBottom ?? true;
    },
  };
};
