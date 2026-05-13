import {
  type ContributionMetadata,
  normalizeContributionMetadata,
  type RegisteredContributionMetadata,
} from "../contributions/metadata";
import { createDisposable } from "../disposable";
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

export const createNavigationRegistry = () => {
  const parsers = new Map<string, RegisteredNavigationParser>();
  const navigators = new Map<string, RegisteredResourceNavigator>();

  return {
    registerParser(parser: NavigationParser, metadata?: ContributionMetadata) {
      if (parsers.has(parser.id)) throw new Error(`Navigation parser already registered: ${parser.id}`);

      const { priority, ...parserContribution } = parser;
      const record = {
        ...parserContribution,
        ...normalizeContributionMetadata({ ...metadata, priority: metadata?.priority ?? priority }),
      };

      parsers.set(parser.id, record);

      return createDisposable(() => {
        if (parsers.get(parser.id) === record) parsers.delete(parser.id);
      });
    },

    listParsers() {
      return [...parsers.values()].sort(byPriorityAndId);
    },

    resolveLocation(location: string) {
      const parser = this.listParsers().find((candidate) => candidate.canParse(location));
      if (!parser) throw new Error(`No navigation parser registered for location: ${location}`);

      return parser.parse(location);
    },

    registerNavigator(navigator: ResourceNavigator, metadata?: ContributionMetadata) {
      if (navigators.has(navigator.id)) throw new Error(`Resource navigator already registered: ${navigator.id}`);

      const { priority, ...navigatorContribution } = navigator;
      const record = {
        ...navigatorContribution,
        ...normalizeContributionMetadata({ ...metadata, priority: metadata?.priority ?? priority }),
      };

      navigators.set(navigator.id, record);

      return createDisposable(() => {
        if (navigators.get(navigator.id) === record) navigators.delete(navigator.id);
      });
    },

    listNavigators() {
      return [...navigators.values()].sort(byPriorityAndId);
    },

    createHref(resource: ResourceRef) {
      const navigator = this.listNavigators().find(
        (candidate) => candidate.createHref && candidate.canNavigate(resource),
      );
      if (!navigator?.createHref) throw new Error(`No navigator href registered for resource kind: ${resource.kind}`);

      return navigator.createHref(resource);
    },

    async navigateResource(resource: ResourceRef) {
      const navigator = this.listNavigators().find((candidate) => candidate.canNavigate(resource));
      if (!navigator) throw new Error(`No navigator registered for resource kind: ${resource.kind}`);

      return await navigator.navigate(resource);
    },
  };
};

export type NavigationRegistry = ReturnType<typeof createNavigationRegistry>;
