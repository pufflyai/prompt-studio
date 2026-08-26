import {
  type ContributionMetadata,
  normalizeContributionMetadata,
  type RegisteredContributionMetadata,
} from "../../shared/contributions/metadata";
import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";
import type { OpenWorkbenchPanelInput, WorkbenchPanelInstance } from "../layout/layout-types";
import type { ResourceRef } from "../resources/resource-registry";

export const workbenchViewIdContextKey = "workbench.view.id";

export interface WorkbenchViewContribution {
  id: string;
  panelId: string;
  title?: string;
  icon?: string;
  path?: string;
  pathAliases?: readonly string[];
  aliases?: readonly string[];
  resource?: ResourceRef;
  canResolve?(): boolean;
  resolveInput?(input: OpenWorkbenchViewInput): OpenWorkbenchPanelInput;
}

export type RegisteredWorkbenchView = WorkbenchViewContribution & RegisteredContributionMetadata;

export type OpenWorkbenchViewInput = Omit<OpenWorkbenchPanelInput, "viewId">;

export interface WorkbenchViewOpenEvent {
  viewId: string;
  input: OpenWorkbenchViewInput;
  instance: WorkbenchPanelInstance;
}

export interface WorkbenchViewRegistryStoreState {
  views: Record<string, RegisteredWorkbenchView>;
  aliases: Record<string, string>;
  paths: Record<string, string>;
}

export interface WorkbenchViewRegistry {
  store: WorkbenchStore<WorkbenchViewRegistryStoreState>;
  registerView(view: WorkbenchViewContribution, metadata?: ContributionMetadata): Disposable;
  getView(viewId: string): RegisteredWorkbenchView | undefined;
  listViews(): RegisteredWorkbenchView[];
  resolveViewId(viewId: string): string | undefined;
  resolvePath(path: string): { kind: "view"; viewId: string } | undefined;
  canResolveView(viewId: string): boolean;
  isOpeningView(): boolean;
  openView(viewId: string, input?: OpenWorkbenchViewInput): Promise<WorkbenchPanelInstance>;
  onDidOpenView(listener: (event: WorkbenchViewOpenEvent) => void): Disposable;
}

export interface CreateWorkbenchViewRegistryInput {
  getPanel(panelId: string): unknown;
  openPanel(panelId: string, input?: OpenWorkbenchPanelInput): WorkbenchPanelInstance | Promise<WorkbenchPanelInstance>;
}

const byPriorityAndId = (left: RegisteredWorkbenchView, right: RegisteredWorkbenchView) =>
  right.priority - left.priority || left.id.localeCompare(right.id);

const removeKeys = (record: Record<string, string>, keys: readonly string[]) => {
  const next = { ...record };
  for (const key of keys) delete next[key];
  return next;
};

export const createViewRegistry = (input: CreateWorkbenchViewRegistryInput): WorkbenchViewRegistry => {
  const listeners = new Set<(event: WorkbenchViewOpenEvent) => void>();
  let openingViewDepth = 0;
  const store = createWorkbenchStore<WorkbenchViewRegistryStoreState>({
    name: "workbench.views",
    initialState: { views: {}, aliases: {}, paths: {} },
  });

  const resolveViewId = (viewId: string) => {
    const snapshot = store.getState();
    if (snapshot.views[viewId]) return viewId;
    return snapshot.aliases[viewId];
  };

  return {
    store,

    registerView(view, metadata) {
      const snapshot = store.getState();
      if (snapshot.views[view.id] || snapshot.aliases[view.id]) throw new Error(`View already registered: ${view.id}`);
      if (!input.getPanel(view.panelId)) throw new Error(`View backing panel is not registered: ${view.panelId}`);

      const aliases = [...(view.aliases ?? [])];
      for (const alias of aliases) {
        if (snapshot.views[alias] || snapshot.aliases[alias] || alias === view.id) {
          throw new Error(`View alias already registered: ${alias}`);
        }
      }

      const paths = [view.path, ...(view.pathAliases ?? [])].filter((path): path is string => Boolean(path));
      for (const path of paths) {
        if (snapshot.paths[path]) throw new Error(`View path already registered: ${path}`);
      }

      const record: RegisteredWorkbenchView = {
        ...view,
        ...normalizeContributionMetadata(metadata),
      };
      store.setState(
        {
          views: { ...snapshot.views, [view.id]: record },
          aliases: { ...snapshot.aliases, ...Object.fromEntries(aliases.map((alias) => [alias, view.id])) },
          paths: { ...snapshot.paths, ...Object.fromEntries(paths.map((path) => [path, view.id])) },
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
            aliases: removeKeys(current.aliases, aliases),
            paths: removeKeys(current.paths, paths),
          },
          false,
          "unregisterView",
        );
      });
    },

    getView(viewId) {
      const resolved = resolveViewId(viewId);
      return resolved ? store.getState().views[resolved] : undefined;
    },

    listViews() {
      return Object.values(store.getState().views).sort(byPriorityAndId);
    },

    resolveViewId,

    resolvePath(path) {
      const viewId = store.getState().paths[path];
      return viewId ? { kind: "view", viewId } : undefined;
    },

    canResolveView(viewId) {
      const view = this.getView(viewId);
      return Boolean(view && input.getPanel(view.panelId) && (view.canResolve?.() ?? true));
    },

    isOpeningView() {
      return openingViewDepth > 0;
    },

    async openView(viewId, openInput = {}) {
      const view = this.getView(viewId);
      if (!view) throw new Error(`View is not registered: ${viewId}`);
      if (!this.canResolveView(view.id)) throw new Error(`View is not ready: ${view.id}`);

      const resolvedInput = view.resolveInput?.(openInput) ?? openInput;
      const panelInput: OpenWorkbenchPanelInput = {
        ...resolvedInput,
        resource: resolvedInput.resource === undefined ? (view.resource ?? null) : resolvedInput.resource,
        title: resolvedInput.title ?? view.title,
        viewId: view.id,
      };
      openingViewDepth += 1;
      let instance: WorkbenchPanelInstance;
      try {
        instance = await input.openPanel(view.panelId, panelInput);
      } finally {
        openingViewDepth -= 1;
      }
      const event = { viewId: view.id, input: openInput, instance };
      for (const listener of listeners) listener(event);
      return instance;
    },

    onDidOpenView(listener) {
      listeners.add(listener);
      return createDisposable(() => listeners.delete(listener));
    },
  };
};
