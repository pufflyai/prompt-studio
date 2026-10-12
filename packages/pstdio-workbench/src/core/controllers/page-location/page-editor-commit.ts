import type { WorkbenchPageRegistryStoreState, WorkbenchPageResourceCodec } from "../../registries/pages/page-registry";
import { batchWorkbenchChanges } from "../../shared/store/workbench-batch";
import { workbenchPageLocationsEqual } from "./page-location-normalization";
import type { createPageLocationPublisher } from "./page-location-publish";
import type { CreateWorkbenchPageLocationControllerInput, ResolvedPageLocation } from "./page-location-types";

export const createPreparedPageCommit =
  <Value>(
    input: CreateWorkbenchPageLocationControllerInput<Value>,
    publish: ReturnType<typeof createPageLocationPublisher<Value>>,
    resources: WorkbenchPageResourceCodec,
  ) =>
  (
    state: WorkbenchPageRegistryStoreState<Value>,
    beforePublish?: () => void,
    requestedHistory?: "push" | "replace" | "none",
  ) => {
    if (!state.projectId || !state.location) throw new Error("Cannot navigate before a project is active");
    const history = workbenchPageLocationsEqual(
      input.registry.store.getState().location,
      state.location,
      resources,
      input.registry.listPages(),
    )
      ? "none"
      : "push";
    return publish(state.projectId, state, requestedHistory ?? history, "navigateCompoundTarget", beforePublish);
  };

export const createPageEditorCommit =
  <Value>(
    input: CreateWorkbenchPageLocationControllerInput<Value>,
    publish: ReturnType<typeof createPageLocationPublisher<Value>>,
    resources: WorkbenchPageResourceCodec,
  ) =>
  (projectId: string, resolved: ResolvedPageLocation, history: "push" | "replace" | "none", action: string) => {
    const existing = input.resolveExistingEditor?.(resolved);
    if (!existing) return undefined;
    const pages = input.registry.listPages();
    let finalHistory = history;
    if (
      history === "push" &&
      workbenchPageLocationsEqual(input.registry.store.getState().location, existing.state.location, resources, pages)
    )
      finalHistory = "none";
    if (
      history === "none" &&
      !workbenchPageLocationsEqual(resolved.location, existing.state.location, resources, pages)
    )
      finalHistory = "replace";
    return batchWorkbenchChanges(() => {
      const result = publish(projectId, existing.state, finalHistory, action);
      existing.activate();
      return result;
    });
  };
