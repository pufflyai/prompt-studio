import {
  byContributionPriority,
  type ContributionMetadata,
  normalizeContributionMetadata,
} from "../../shared/contributions/metadata";
import { createDisposable } from "../../shared/disposable";
import type { InternalWorkbenchStore } from "../../shared/store/workbench-store";
import { getActivePlacement, removePlacementsForContribution } from "./layout-operations";
import type {
  PlaceholderContribution,
  RegisteredPlaceholderContribution,
  RegisteredWidgetContribution,
  WidgetContribution,
  WorkbenchLayout,
  WorkbenchLayoutStoreState,
  WorkbenchRegion,
} from "./layout-types";

interface CreateRegionQueriesInput {
  getLayout(): WorkbenchLayout;
  getWidgets(): WorkbenchLayoutStoreState["widgets"];
  getPlaceholder(regionId: WorkbenchRegion): RegisteredPlaceholderContribution | undefined;
}

export const createRegionQueries = (input: CreateRegionQueriesInput) => {
  const { getLayout, getWidgets, getPlaceholder } = input;

  return {
    getRegionSize(regionId: WorkbenchRegion) {
      const persistedSize = getLayout().regions[regionId].size;
      const placement = getActivePlacement(getLayout().regions[regionId]);
      const contributionSize = placement
        ? getWidgets()[placement.contributionId]?.regionSize
        : getPlaceholder(regionId)?.regionSize;
      if (persistedSize === undefined) return contributionSize;
      return { ...contributionSize, defaultPx: persistedSize };
    },

    getRegionCollapsible(regionId: WorkbenchRegion) {
      const placement = getActivePlacement(getLayout().regions[regionId]);
      if (!placement) return getPlaceholder(regionId)?.regionCollapsible ?? true;
      return getWidgets()[placement.contributionId]?.regionCollapsible ?? true;
    },

    getRegionHeaderBorderBottom(regionId: WorkbenchRegion) {
      const placement = getActivePlacement(getLayout().regions[regionId]);
      if (!placement) return true;
      return getWidgets()[placement.contributionId]?.headerBorderBottom ?? true;
    },
  };
};

export const createContributionLists = (input: {
  getPlaceholders(): WorkbenchLayoutStoreState["placeholders"];
  getWidgets(): WorkbenchLayoutStoreState["widgets"];
}) => {
  const { getPlaceholders, getWidgets } = input;

  return {
    listPlaceholders: () => Object.values(getPlaceholders()).sort(byContributionPriority),
    listWidgets: () => Object.values(getWidgets()).sort(byContributionPriority),
  };
};

export const createContributionRegistrations = (input: {
  store: InternalWorkbenchStore<WorkbenchLayoutStoreState>;
  getPlaceholders(): WorkbenchLayoutStoreState["placeholders"];
  getWidgets(): WorkbenchLayoutStoreState["widgets"];
  persistLayout(): void;
}) => {
  const { store, getPlaceholders, getWidgets, persistLayout } = input;

  return {
    registerPlaceholder(placeholder: PlaceholderContribution, metadata?: ContributionMetadata) {
      if (getPlaceholders()[placeholder.region]) {
        throw new Error(`Placeholder already registered: ${placeholder.region}`);
      }

      const { priority, ...placeholderContribution } = placeholder;
      const record: RegisteredPlaceholderContribution = {
        ...placeholderContribution,
        ...normalizeContributionMetadata({ ...metadata, priority: metadata?.priority ?? priority }),
      };
      const snapshot = store.getState();
      store.setState(
        { ...snapshot, placeholders: { ...snapshot.placeholders, [placeholder.region]: record } },
        false,
        "registerPlaceholder",
      );

      return createDisposable(() => {
        const current = store.getState();
        if (current.placeholders[placeholder.region] !== record) return;
        const { [placeholder.region]: _removed, ...nextPlaceholders } = current.placeholders;
        store.setState({ ...current, placeholders: nextPlaceholders }, false, "unregisterPlaceholder");
      });
    },

    registerWidget(widget: WidgetContribution, metadata?: ContributionMetadata) {
      if (getWidgets()[widget.id]) throw new Error(`Widget already registered: ${widget.id}`);

      const { priority, reuse, singleton, ...widgetContribution } = widget;
      const record: RegisteredWidgetContribution = {
        ...widgetContribution,
        reuse: reuse ?? "resource",
        singleton: singleton ?? true,
        ...normalizeContributionMetadata({ ...metadata, priority: metadata?.priority ?? priority }),
      };
      const snapshot = store.getState();
      store.setState({ ...snapshot, widgets: { ...snapshot.widgets, [widget.id]: record } }, false, "registerWidget");

      return createDisposable(() => {
        const current = store.getState();
        if (current.widgets[widget.id] !== record) return;
        const { [widget.id]: _removed, ...nextWidgets } = current.widgets;
        const nextLayout = removePlacementsForContribution(current.layout, widget.id);
        store.setState({ widgets: nextWidgets, layout: nextLayout }, false, "unregisterWidget");
        persistLayout();
      });
    },
  };
};
