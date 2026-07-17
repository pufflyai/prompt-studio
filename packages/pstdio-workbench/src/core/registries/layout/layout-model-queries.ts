import { getActivePlacement } from "./layout-operations";
import type {
  RegisteredPlaceholderContribution,
  SlotId,
  WorkbenchAreaState,
  WorkbenchLayout,
  WorkbenchLayoutStoreState,
} from "./layout-types";

interface CreateAreaQueriesInput {
  getLayout(): WorkbenchLayout;
  getWidgets(): WorkbenchLayoutStoreState["widgets"];
  getPlaceholder(areaId: SlotId): RegisteredPlaceholderContribution | undefined;
  requireArea(areaId: SlotId): WorkbenchAreaState;
}

export const createAreaQueries = (input: CreateAreaQueriesInput) => {
  const { getLayout, getWidgets, getPlaceholder, requireArea } = input;

  return {
    getAreaSize(areaId: SlotId) {
      const area = requireArea(areaId);
      const persistedSize = getLayout().nodes[areaId]?.size;
      const placement = getActivePlacement(area);
      const contributionSize = placement
        ? getWidgets()[placement.contributionId]?.areaSize
        : getPlaceholder(areaId)?.areaSize;
      if (persistedSize === undefined) return contributionSize;
      return { ...contributionSize, defaultPx: persistedSize };
    },

    getAreaCollapsible(areaId: SlotId) {
      const placement = getActivePlacement(requireArea(areaId));
      if (!placement) return getPlaceholder(areaId)?.areaCollapsible ?? true;
      return getWidgets()[placement.contributionId]?.areaCollapsible ?? true;
    },

    getAreaHeaderBorderBottom(areaId: SlotId) {
      const placement = getActivePlacement(requireArea(areaId));
      if (!placement) return true;
      return getWidgets()[placement.contributionId]?.headerBorderBottom ?? true;
    },
  };
};
