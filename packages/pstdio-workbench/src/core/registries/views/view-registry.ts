import {
  type ContributionMetadata,
  normalizeContributionMetadata,
  type RegisteredContributionMetadata,
} from "../../shared/contributions/metadata";
import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";
import type { ControlsRendererContribution } from "../renderers/controls-renderer-registry";
import type { DataTableRendererContribution } from "../renderers/data-table-renderer-registry";
import type { FileRendererContribution } from "../renderers/file-renderer-registry";
import type { KanbanRendererContribution } from "../renderers/kanban-renderer-registry";
import type { WorkbenchRendererRegistration } from "../renderers/renderer-registry";
import type { TreeRendererContribution } from "../renderers/tree-renderer-registry";

export const workbenchViewIdContextKey = "workbench.view.id";

type NativeViewBody<Kind extends string, Contribution> = { kind: Kind } & Omit<Contribution, "id" | "title" | "icon">;

export interface WorkbenchReactViewBody {
  kind: "react";
  render: WorkbenchRendererRegistration["render"];
}

export type WorkbenchViewBody =
  | WorkbenchReactViewBody
  | NativeViewBody<"tree", TreeRendererContribution>
  | NativeViewBody<"file", FileRendererContribution>
  | NativeViewBody<"controls", ControlsRendererContribution>
  | NativeViewBody<"kanban", KanbanRendererContribution>
  | NativeViewBody<"dataTable", DataTableRendererContribution>;

export interface WorkbenchViewContribution {
  id: string;
  title: string;
  icon?: string;
  body: WorkbenchViewBody;
}

export type RegisteredWorkbenchView = WorkbenchViewContribution & RegisteredContributionMetadata;

export interface WorkbenchViewRegistryStoreState {
  views: Record<string, RegisteredWorkbenchView>;
}

export interface WorkbenchViewRegistry {
  store: WorkbenchStore<WorkbenchViewRegistryStoreState>;
  registerView(view: WorkbenchViewContribution, metadata?: ContributionMetadata): Disposable;
  getView(viewId: string): RegisteredWorkbenchView | undefined;
  listViews(): RegisteredWorkbenchView[];
  refreshView(viewId: string, input?: unknown): void;
}

export interface CreateWorkbenchViewRegistryInput {
  registerBody(
    view: WorkbenchViewContribution,
    metadata?: ContributionMetadata,
  ): Disposable & { refresh?(input?: unknown): void };
}

const byPriorityAndId = (left: RegisteredWorkbenchView, right: RegisteredWorkbenchView) =>
  right.priority - left.priority || left.id.localeCompare(right.id);

export const createViewRegistry = (input: CreateWorkbenchViewRegistryInput): WorkbenchViewRegistry => {
  const store = createWorkbenchStore<WorkbenchViewRegistryStoreState>({
    name: "workbench.views",
    initialState: { views: {} },
  });
  const bodies = new Map<string, Disposable & { refresh?(input?: unknown): void }>();

  return {
    store,

    registerView(view, metadata) {
      const snapshot = store.getState();
      if (snapshot.views[view.id]) throw new Error(`View already registered: ${view.id}`);

      const body = input.registerBody(view, metadata);
      bodies.set(view.id, body);

      const record: RegisteredWorkbenchView = {
        ...view,
        ...normalizeContributionMetadata(metadata),
      };
      store.setState(
        {
          views: { ...snapshot.views, [view.id]: record },
        },
        false,
        "registerView",
      );

      return createDisposable(() => {
        const current = store.getState();
        if (current.views[view.id] !== record) return;
        const { [view.id]: _removed, ...views } = current.views;
        store.setState(
          {
            views,
          },
          false,
          "unregisterView",
        );
        body.dispose();
        bodies.delete(view.id);
      });
    },

    getView(viewId) {
      return store.getState().views[viewId];
    },

    listViews() {
      return Object.values(store.getState().views).sort(byPriorityAndId);
    },

    refreshView(viewId, refreshInput) {
      if (!store.getState().views[viewId]) throw new Error(`View is not registered: ${viewId}`);
      bodies.get(viewId)?.refresh?.(refreshInput);
    },
  };
};
