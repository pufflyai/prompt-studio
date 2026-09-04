import type {
  NavigationTargetPage as SdkNavigationTargetPage,
  NavigationTargetPanel as SdkNavigationTargetPanel,
} from "@pstdio/sdk/extensions";
import {
  type ContributionMetadata,
  normalizeContributionMetadata,
  type RegisteredContributionMetadata,
} from "../../shared/contributions/metadata";
import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";

/** Core-only panel ref for host-owned shell placements. Extensions cannot address them. */
export interface ShellPlacementRef {
  kind: "shell-placement";
  id: string;
}

export interface NavigationTargetShellPanel {
  kind: "panel";
  panel: ShellPlacementRef;
  resource?: SdkNavigationTargetPanel["resource"];
  open?: SdkNavigationTargetPanel["open"];
  title?: string;
}

export type NavigationTargetPanel = SdkNavigationTargetPanel | NavigationTargetShellPanel;

export type NavigationTargetPage = SdkNavigationTargetPage;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

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
  | NavigationTargetPage
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

// Minimal presenter surface the navigation dispatcher needs; resolved through a
// closure to break the otherwise-circular core ↔ navigation dep.
export interface NavigationDispatcherContext {
  canOpenPanel?(target: NavigationTargetPanel): boolean;
  canExecuteCommand?(commandId: string): boolean;
  createCheckpoint?(): undefined | (() => void);
  openPanelTarget?(target: NavigationTargetPanel): unknown;
  openPageTarget?(target: NavigationTargetPage): unknown;
  executeCommand(commandId: string, args?: unknown): Promise<unknown> | unknown;
  openHref?(href: string): Promise<unknown> | unknown;
}

const byPriorityAndId = (left: { id: string; priority: number }, right: { id: string; priority: number }) =>
  right.priority - left.priority || left.id.localeCompare(right.id);

export interface NavigationRegistryStoreState {
  parsers: Record<string, RegisteredNavigationParser>;
}

export interface NavigationRegistry {
  store: WorkbenchStore<NavigationRegistryStoreState>;
  registerParser(parser: NavigationParser, metadata?: ContributionMetadata): Disposable;
  listParsers(): RegisteredNavigationParser[];
  resolveLocation(location: string): NavigationTarget;
  openTarget(target: NavigationTarget): Promise<readonly unknown[]>;
  /** Opens a page location through the shared executor. */
  openPage(target: Omit<NavigationTargetPage, "kind">): Promise<readonly unknown[]>;
  /** Opens or activates an owned panel through the shared executor. */
  openPanel(target: DistributiveOmit<NavigationTargetPanel, "kind">): Promise<readonly unknown[]>;
  navigate(location: string): Promise<readonly unknown[]>;
}

export interface CreateNavigationRegistryInput {
  // Returns the presenters the dispatcher should call. Lazy so `createWorkbench`
  // can install the navigation registry before the rest of the core is ready.
  resolveDispatcher?(): NavigationDispatcherContext;
}

const noDispatcher = (): NavigationDispatcherContext => {
  throw new Error("navigation.openTarget: no dispatcher available (configure resolveDispatcher)");
};

const dispatchItem = async (target: NavigationTargetItem, dispatcher: NavigationDispatcherContext) => {
  if (target.kind === "page") {
    if (!dispatcher.openPageTarget) throw new Error("navigation.openTarget: page target dispatcher is not configured");
    return dispatcher.openPageTarget(target);
  }
  if (target.kind === "panel") {
    if (!dispatcher.openPanelTarget)
      throw new Error("navigation.openTarget: panel target dispatcher is not configured");
    return dispatcher.openPanelTarget(target);
  }
  if (target.kind === "href") {
    if (!dispatcher.openHref) throw new Error(`Cannot open navigation href target: ${target.href}`);
    return dispatcher.openHref(target.href);
  }
  return dispatcher.executeCommand(target.commandId, target.args);
};

const validateItem = (target: NavigationTargetItem, dispatcher: NavigationDispatcherContext) => {
  if (target.kind === "panel" && dispatcher.canOpenPanel?.(target) === false) {
    throw new Error(`Cannot open navigation panel target: ${target.panel.id}`);
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
    initialState: { parsers: {} },
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

    async openPage(target) {
      return registry.openTarget({ ...target, kind: "page" });
    },

    async openPanel(target) {
      return registry.openTarget({ ...target, kind: "panel" } as NavigationTargetPanel);
    },

    async navigate(location) {
      return registry.openTarget(registry.resolveLocation(location));
    },
  };

  return registry;
};
