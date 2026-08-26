import {
  type ContributionMetadata,
  normalizeContributionMetadata,
  type RegisteredContributionMetadata,
} from "../../shared/contributions/metadata";
import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";
import type { OpenWorkbenchPanelInput } from "../layout/layout-types";
import type { OpenResourceInput, ResourceRef } from "../resources/resource-registry";
import type { OpenWorkbenchViewInput } from "../views/view-registry";

export interface NavigationTargetResource {
  kind: "resource";
  resource: ResourceRef;
  input?: OpenResourceInput;
}

export interface NavigationTargetPanel {
  kind: "panel";
  panelId: string;
  input?: OpenWorkbenchPanelInput;
}

export interface NavigationTargetView {
  kind: "view";
  viewId: string;
  input?: OpenWorkbenchViewInput;
}

export interface NavigationTargetCommand {
  kind: "command";
  commandId: string;
  args?: unknown;
}

export interface NavigationTargetHref {
  kind: "href";
  href: string;
}

export type NavigationTargetItem =
  | NavigationTargetResource
  | NavigationTargetView
  | NavigationTargetPanel
  | NavigationTargetCommand
  | NavigationTargetHref;

export interface NavigationTargetCompound {
  kind: "compound";
  targets: readonly NavigationTargetItem[];
}

export type NavigationTarget = NavigationTargetItem | NavigationTargetCompound;

export interface NavigationParser {
  id: string;
  priority?: number;
  canParse(location: string): boolean;
  parse(location: string): NavigationTarget;
}

export type RegisteredNavigationParser = Omit<NavigationParser, "priority"> & RegisteredContributionMetadata;

export interface ResourceNavigator<TResult = unknown> {
  id: string;
  priority?: number;
  canNavigate(resource: ResourceRef): boolean;
  createHref?(resource: ResourceRef): string;
  navigate(resource: ResourceRef): TResult | Promise<TResult>;
}

export type RegisteredResourceNavigator = Omit<ResourceNavigator, "priority"> & RegisteredContributionMetadata;

// Minimal presenter surface the navigation dispatcher needs; resolved through a
// closure to break the otherwise-circular core ↔ navigation dep.
export interface NavigationDispatcherContext {
  canOpenResource?(resource: ResourceRef): boolean;
  canOpenPanel?(panelId: string): boolean;
  canOpenView?(viewId: string): boolean;
  canExecuteCommand?(commandId: string): boolean;
  createCheckpoint?(): undefined | (() => void);
  openResource(resource: ResourceRef, input?: OpenResourceInput): Promise<unknown>;
  openPanel(panelId: string, input?: OpenWorkbenchPanelInput): unknown;
  openView(viewId: string, input?: OpenWorkbenchViewInput): Promise<unknown> | unknown;
  executeCommand(commandId: string, args?: unknown): Promise<unknown> | unknown;
  openHref?(href: string): Promise<unknown> | unknown;
}

const byPriorityAndId = (left: { id: string; priority: number }, right: { id: string; priority: number }) =>
  right.priority - left.priority || left.id.localeCompare(right.id);

export interface NavigationRegistryStoreState {
  parsers: Record<string, RegisteredNavigationParser>;
  navigators: Record<string, RegisteredResourceNavigator>;
}

export interface NavigationRegistry {
  store: WorkbenchStore<NavigationRegistryStoreState>;
  registerParser(parser: NavigationParser, metadata?: ContributionMetadata): Disposable;
  listParsers(): RegisteredNavigationParser[];
  resolveLocation(location: string): NavigationTarget;
  openTarget(target: NavigationTarget): Promise<readonly unknown[]>;
  navigate(location: string): Promise<readonly unknown[]>;
  registerNavigator(navigator: ResourceNavigator, metadata?: ContributionMetadata): Disposable;
  listNavigators(): RegisteredResourceNavigator[];
  createHref(resource: ResourceRef): string;
  navigateResource(resource: ResourceRef): Promise<unknown>;
}

export interface CreateNavigationRegistryInput {
  // Returns the presenters the dispatcher should call. Lazy so `createWorkbenchCore`
  // can install the navigation registry before the rest of the core is ready.
  resolveDispatcher?(): NavigationDispatcherContext;
}

const noDispatcher = (): NavigationDispatcherContext => {
  throw new Error("navigation.openTarget: no dispatcher available (configure resolveDispatcher)");
};

const dispatchItem = async (target: NavigationTargetItem, dispatcher: NavigationDispatcherContext) => {
  if (target.kind === "resource") return dispatcher.openResource(target.resource, target.input);
  if (target.kind === "view") return dispatcher.openView(target.viewId, target.input);
  if (target.kind === "panel") return dispatcher.openPanel(target.panelId, target.input);
  if (target.kind === "href") {
    if (!dispatcher.openHref) throw new Error(`Cannot open navigation href target: ${target.href}`);
    return dispatcher.openHref(target.href);
  }
  return dispatcher.executeCommand(target.commandId, target.args);
};

const validateItem = (target: NavigationTargetItem, dispatcher: NavigationDispatcherContext) => {
  if (target.kind === "resource" && dispatcher.canOpenResource?.(target.resource) === false) {
    throw new Error(`Cannot open navigation resource target: ${target.resource.uri}`);
  }
  if (target.kind === "panel" && dispatcher.canOpenPanel?.(target.panelId) === false) {
    throw new Error(`Cannot open navigation Panel target: ${target.panelId}`);
  }
  if (target.kind === "view" && dispatcher.canOpenView?.(target.viewId) === false) {
    throw new Error(`Cannot open navigation view target: ${target.viewId}`);
  }
  if (target.kind === "command" && dispatcher.canExecuteCommand?.(target.commandId) === false) {
    throw new Error(`Cannot open navigation command target: ${target.commandId}`);
  }
};

const toItems = (target: NavigationTarget): readonly NavigationTargetItem[] =>
  target.kind === "compound" ? target.targets : [target];

export const createNavigationRegistry = (input: CreateNavigationRegistryInput = {}): NavigationRegistry => {
  const resolveDispatcher = input.resolveDispatcher ?? noDispatcher;

  const store = createWorkbenchStore<NavigationRegistryStoreState>({
    name: "workbench.navigation",
    initialState: { parsers: {}, navigators: {} },
  });

  const removeKey = <T>(record: Record<string, T>, key: string): Record<string, T> => {
    const { [key]: _removed, ...rest } = record;
    return rest;
  };

  const registry: NavigationRegistry = {
    store,

    registerParser(parser, metadata) {
      const snapshot = store.getState();
      if (snapshot.parsers[parser.id]) throw new Error(`Navigation parser already registered: ${parser.id}`);

      const { priority, ...parserContribution } = parser;
      const record: RegisteredNavigationParser = {
        ...parserContribution,
        ...normalizeContributionMetadata({ ...metadata, priority: metadata?.priority ?? priority }),
      };

      store.setState({ ...snapshot, parsers: { ...snapshot.parsers, [parser.id]: record } }, false, "registerParser");

      return createDisposable(() => {
        const current = store.getState();
        if (current.parsers[parser.id] !== record) return;
        store.setState({ ...current, parsers: removeKey(current.parsers, parser.id) }, false, "unregisterParser");
      });
    },

    listParsers() {
      return Object.values(store.getState().parsers).sort(byPriorityAndId);
    },

    resolveLocation(location) {
      const parser = this.listParsers().find((candidate) => candidate.canParse(location));
      if (!parser) throw new Error(`No navigation parser registered for location: ${location}`);
      return parser.parse(location);
    },

    async openTarget(target) {
      const dispatcher = resolveDispatcher();
      const items = toItems(target);
      const results: unknown[] = [];

      for (const item of items) validateItem(item, dispatcher);

      const rollback = target.kind === "compound" ? dispatcher.createCheckpoint?.() : undefined;
      try {
        for (const item of items) {
          // Sequential by design: a `compound` target's items often depend on
          // each other (open resource, then reveal the view that hosts it).
          const result = await dispatchItem(item, dispatcher);
          results.push(result);
        }
      } catch (error) {
        rollback?.();
        throw error;
      }
      return results;
    },

    async navigate(location) {
      return registry.openTarget(registry.resolveLocation(location));
    },

    registerNavigator(navigator, metadata) {
      const snapshot = store.getState();
      if (snapshot.navigators[navigator.id]) throw new Error(`Resource navigator already registered: ${navigator.id}`);

      const { priority, ...navigatorContribution } = navigator;
      const record: RegisteredResourceNavigator = {
        ...navigatorContribution,
        ...normalizeContributionMetadata({ ...metadata, priority: metadata?.priority ?? priority }),
      };

      store.setState(
        { ...snapshot, navigators: { ...snapshot.navigators, [navigator.id]: record } },
        false,
        "registerNavigator",
      );

      return createDisposable(() => {
        const current = store.getState();
        if (current.navigators[navigator.id] !== record) return;
        store.setState(
          { ...current, navigators: removeKey(current.navigators, navigator.id) },
          false,
          "unregisterNavigator",
        );
      });
    },

    listNavigators() {
      return Object.values(store.getState().navigators).sort(byPriorityAndId);
    },

    createHref(resource) {
      const navigator = this.listNavigators().find(
        (candidate) => candidate.createHref && candidate.canNavigate(resource),
      );
      if (!navigator?.createHref) throw new Error(`No navigator href registered for resource kind: ${resource.kind}`);
      return navigator.createHref(resource);
    },

    async navigateResource(resource) {
      const navigator = this.listNavigators().find((candidate) => candidate.canNavigate(resource));
      if (!navigator) throw new Error(`No navigator registered for resource kind: ${resource.kind}`);
      return await navigator.navigate(resource);
    },
  };

  return registry;
};
