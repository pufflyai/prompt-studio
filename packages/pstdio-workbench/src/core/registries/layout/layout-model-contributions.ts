import {
  byContributionPriority,
  type ContributionMetadata,
  normalizeContributionMetadata,
} from "../../shared/contributions/metadata";
import { createDisposable } from "../../shared/disposable";
import type { InternalWorkbenchStore } from "../../shared/store/workbench-store";
import { removePlacementsForContribution } from "./layout-operations";
import type {
  PlaceholderContribution,
  RegisteredPlaceholderContribution,
  RegisteredWidgetContribution,
  WidgetContribution,
  WorkbenchLayoutStoreState,
} from "./layout-types";

interface CreateContributionListsInput {
  getPlaceholders(): WorkbenchLayoutStoreState["placeholders"];
  getWidgets(): WorkbenchLayoutStoreState["widgets"];
}

interface CreateContributionRegistrationsInput {
  store: InternalWorkbenchStore<WorkbenchLayoutStoreState>;
  getPlaceholders(): WorkbenchLayoutStoreState["placeholders"];
  getWidgets(): WorkbenchLayoutStoreState["widgets"];
  persistLayout(): void;
}

export const createContributionLists = (input: CreateContributionListsInput) => {
  const { getPlaceholders, getWidgets } = input;

  return {
    listPlaceholders() {
      return Object.values(getPlaceholders()).sort(byContributionPriority);
    },

    listWidgets() {
      return Object.values(getWidgets()).sort(byContributionPriority);
    },
  };
};

export const createContributionRegistrations = (input: CreateContributionRegistrationsInput) => {
  const { store, getPlaceholders, getWidgets, persistLayout } = input;

  return {
    registerPlaceholder(placeholder: PlaceholderContribution, metadata?: ContributionMetadata) {
      const placeholdersBefore = getPlaceholders();
      if (placeholdersBefore[placeholder.area]) {
        throw new Error(`Placeholder already registered: ${placeholder.area}`);
      }

      const { priority, ...placeholderContribution } = placeholder;
      const record: RegisteredPlaceholderContribution = {
        ...placeholderContribution,
        ...normalizeContributionMetadata({ ...metadata, priority: metadata?.priority ?? priority }),
      };

      const snapshot = store.getState();
      store.setState(
        { ...snapshot, placeholders: { ...snapshot.placeholders, [placeholder.area]: record } },
        false,
        "registerPlaceholder",
      );

      return createDisposable(() => {
        const current = store.getState();
        if (current.placeholders[placeholder.area] !== record) return;

        const { [placeholder.area]: _removed, ...nextPlaceholders } = current.placeholders;
        store.setState({ ...current, placeholders: nextPlaceholders }, false, "unregisterPlaceholder");
      });
    },

    registerWidget(widget: WidgetContribution, metadata?: ContributionMetadata) {
      const widgetsBefore = getWidgets();
      if (widgetsBefore[widget.id]) throw new Error(`Widget already registered: ${widget.id}`);

      const { priority, reuse, singleton, ...widgetContribution } = widget;
      const record: RegisteredWidgetContribution = {
        ...widgetContribution,
        reuse: reuse ?? "resource",
        // Panels are singleton by default; widgets opt into tabbed placements
        // by declaring `singleton: false`.
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
        store.setState({ ...current, widgets: nextWidgets, layout: nextLayout }, false, "unregisterWidget");
        persistLayout();
      });
    },
  };
};
