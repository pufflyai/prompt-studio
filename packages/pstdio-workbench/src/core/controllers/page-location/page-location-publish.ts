import type { PageLocation } from "@pstdio/sdk/extensions";
import type { WorkbenchPageRegistry, WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import {
  getWorkbenchPageRegistryInternals,
  type WorkbenchPageRegistryInternals,
} from "../../registries/pages/page-registry-internals";
import { batchWorkbenchChanges } from "../../shared/store/workbench-batch";
import { runWorkbenchEffect } from "../../shared/workbench-effect";
import type { createPageHistoryEntry } from "./page-location-history-entry";
import { workbenchPageLocationsEqual } from "./page-location-normalization";
import { refreshOpenPageInstances } from "./page-location-refresh";
import type {
  CreateWorkbenchPageLocationControllerInput,
  RememberedWorkbenchPageLocation,
  ResolvedPageLocation,
} from "./page-location-types";

export const createPageLocationPublisher = <Value>(
  input: CreateWorkbenchPageLocationControllerInput<Value>,
  internals: WorkbenchPageRegistryInternals<Value>,
  hooks: {
    getIndex(): number;
    commitIndex(index: number, push: boolean): void;
    entry: ReturnType<typeof createPageHistoryEntry>;
    publish(): void;
    rememberRootLevel(location: PageLocation): PageLocation | undefined;
    rememberLocation(location: PageLocation): readonly RememberedWorkbenchPageLocation[];
  },
) => {
  return (
    projectId: string,
    state: WorkbenchPageRegistryStoreState<Value>,
    history: "push" | "replace" | "none",
    action: string,
    beforePublish?: () => void,
    operation: "navigate" | "select" = "navigate",
  ) =>
    batchWorkbenchChanges(() => {
      const location = state.location;
      if (!location) throw new Error("Prepared page navigation has no location");
      const nextIndex = history === "push" ? hooks.getIndex() + 1 : hooks.getIndex();
      // Browser history is the commit boundary. Serialization and the browser write
      // can fail, so both precede changes to stores, placement owners, and caches.
      if (history !== "none") input.browser[history](hooks.entry(projectId, location, nextIndex));
      hooks.commitIndex(nextIndex, history === "push");
      beforePublish?.();
      internals.publish(state, action, operation);
      const rootLevel = hooks.rememberRootLevel(location);
      const remembered = hooks.rememberLocation(location);
      runWorkbenchEffect(`page location cache for ${projectId}`, () =>
        input.persistence.save(projectId, { location, remembered, ...(rootLevel ? { rootLevel } : {}) }),
      );
      if (history !== "none") hooks.publish();
      return { ok: true, location } as const;
    });
};

export const createPageLocationReplayer =
  <Value>(input: {
    registry: WorkbenchPageRegistry<Value>;
    prepare(projectId: string, resolved: ResolvedPageLocation, action: string): WorkbenchPageRegistryStoreState<Value>;
    publish: ReturnType<typeof createPageLocationPublisher<Value>>;
    consumeRemembered?(location: PageLocation | undefined): void;
  }) =>
  (projectId: string, resolved: ResolvedPageLocation) => {
    const action = "replayWorkbenchPageHistory";
    const current = input.registry.store.getState();
    const state = input.prepare(projectId, resolved, action);
    const { resources } = getWorkbenchPageRegistryInternals(input.registry);
    // Hydrating the current location updates its views without reselecting Main.
    const refresh =
      current.projectId === projectId &&
      workbenchPageLocationsEqual(current.location, resolved.location, resources, input.registry.listPages());
    const next = refresh
      ? getWorkbenchPageRegistryInternals(input.registry).prepare.compose(current, {
          ...current,
          location: state.location,
          pageStates: refreshOpenPageInstances(current.pageStates, state.pageStates),
          activate: [],
          action,
        })
      : state;
    return input.publish(projectId, next, "replace", action, () =>
      input.consumeRemembered?.(resolved.consumeRemembered),
    );
  };

export const createPageLocationPreparer = <Value>(registry: WorkbenchPageRegistry<Value>) => {
  const internals = getWorkbenchPageRegistryInternals(registry);
  const target = (projectId: string, resolved: ResolvedPageLocation, action: string) => ({
    pageId: resolved.pageId,
    projectId,
    location: resolved.location,
    action,
    open: resolved.open,
    resource: resolved.location.resource,
    section: resolved.location.section,
    position: resolved.location.position,
    pageStates: resolved.pageStates,
  });
  return {
    select: (projectId: string, resolved: ResolvedPageLocation, action: string) =>
      internals.prepare.selection(target(projectId, resolved, action), registry.store.getState()),
    open: (projectId: string, resolved: ResolvedPageLocation, action: string) =>
      internals.prepare.location(target(projectId, resolved, action), registry.store.getState()),
    restore: (projectId: string, resolved: ResolvedPageLocation, action: string) =>
      internals.prepare.restore(target(projectId, resolved, action), registry.store.getState()),
  };
};

export const createMainViewSelector =
  <Value>(input: {
    prepare: ReturnType<typeof createPageLocationPreparer<Value>>["select"];
    publish: ReturnType<typeof createPageLocationPublisher<Value>>;
  }) =>
  (projectId: string, resolved: ResolvedPageLocation) =>
    input.publish(
      projectId,
      input.prepare(projectId, resolved, "selectMainView"),
      "replace",
      "selectMainView",
      undefined,
      "select",
    );
