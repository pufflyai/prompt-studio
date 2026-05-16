import {
  type ContributionMetadata,
  normalizeContributionMetadata,
  type RegisteredContributionMetadata,
} from "../../shared/contributions/metadata";
import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";
import type { ResourceRef } from "../resources/resource-registry";

export interface NavigationParser {
  id: string;
  priority?: number;
  canParse(location: string): boolean;
  parse(location: string): ResourceRef;
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
  resolveLocation(location: string): ResourceRef;
  registerNavigator(navigator: ResourceNavigator, metadata?: ContributionMetadata): Disposable;
  listNavigators(): RegisteredResourceNavigator[];
  createHref(resource: ResourceRef): string;
  navigateResource(resource: ResourceRef): Promise<unknown>;
}

export const createNavigationRegistry = (): NavigationRegistry => {
  const store = createWorkbenchStore<NavigationRegistryStoreState>({
    name: "workbench.navigation",
    initialState: { parsers: {}, navigators: {} },
  });

  const removeKey = <T>(record: Record<string, T>, key: string): Record<string, T> => {
    const { [key]: _removed, ...rest } = record;
    return rest;
  };

  return {
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
};
