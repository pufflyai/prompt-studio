import { isWorkbenchProjectUrl } from "pstdio-api-contracts";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import { batchWorkbenchChanges } from "../../shared/store/workbench-batch";
import { runWorkbenchEffect } from "../../shared/workbench-effect";
import { configuredDefaultPage, eligibleDefaultPage } from "./default-page";
import type { createPageHistoryEntry, createPageLocationHistory } from "./page-location-history-entry";
import type { CreateWorkbenchPageLocationControllerInput, PersistedWorkbenchPageLocation } from "./page-location-types";
import { isPageHistoryState, isProjectRootUrl } from "./page-url-resolver";

export const createUnavailablePagePublisher =
  <Value>(
    input: CreateWorkbenchPageLocationControllerInput<Value>,
    history: ReturnType<typeof createPageLocationHistory>,
    entry: ReturnType<typeof createPageHistoryEntry>,
  ) =>
  (state: WorkbenchPageRegistryStoreState<Value>, beforePublish: () => void, operation: "push" | "replace" | "none") =>
    batchWorkbenchChanges(() => {
      if (!state.projectId) throw new Error("Cannot navigate before a project is active");
      const index = history.getIndex() + (operation === "push" ? 1 : 0);
      if (operation !== "none") input.browser[operation](entry(state.projectId, undefined, index, state.activeModeId));
      history.commitIndex(index, operation === "push");
      beforePublish();
      getWorkbenchPageRegistryInternals(input.registry).publish(state, "unavailableMain");
      const saved = input.persistence.load(state.projectId);
      runWorkbenchEffect(`page location cache for ${state.projectId}`, () =>
        input.persistence.save(state.projectId!, {
          modeId: state.activeModeId,
          rootLevel: saved?.rootLevel,
          remembered: saved?.remembered,
        }),
      );
      history.publish();
      return undefined;
    });

export const prepareUnavailablePage = <Value>(
  input: CreateWorkbenchPageLocationControllerInput<Value>,
  projectId: string,
  modeId: string,
) => {
  const current = input.registry.store.getState();
  return getWorkbenchPageRegistryInternals(input.registry).prepare.compose(current, {
    projectId,
    activeModeId: modeId,
    pageStates: current.pageStates,
    action: "unavailableMain",
  });
};

export const replayUnavailablePage = <Value>(
  input: CreateWorkbenchPageLocationControllerInput<Value>,
  history: ReturnType<typeof createPageLocationHistory>,
  publish: ReturnType<typeof createUnavailablePagePublisher<Value>>,
) => {
  const entry = input.browser.current();
  const projectId = input.registry.store.getState().projectId;
  if (
    !projectId ||
    !isProjectRootUrl(entry.url, projectId) ||
    !isPageHistoryState(entry.state) ||
    entry.state.projectId !== projectId ||
    entry.state.location ||
    !entry.state.modeId ||
    !input.modes.getMode(entry.state.modeId)
  )
    return false;
  history.adopt(entry.state.index);
  publish(prepareUnavailablePage(input, projectId, entry.state.modeId), () => {}, "none");
  return true;
};

// Missing pages reuse the selected mode, layout persistence and existing page-history entries.
export const clearMissingPage = <Value>(
  input: CreateWorkbenchPageLocationControllerInput<Value>,
  history: ReturnType<typeof createPageLocationHistory>,
  entry: ReturnType<typeof createPageHistoryEntry>,
  projectId: string | undefined,
  operation: "push" | "replace" | "none",
  selectedModeId?: string,
) => {
  const internals = getWorkbenchPageRegistryInternals(input.registry);
  if (!projectId) return false;
  if (operation === "none") {
    const current = input.browser.current();
    if (
      !isWorkbenchProjectUrl(current.url, projectId) ||
      (isPageHistoryState(current.state) && current.state.projectId !== projectId)
    )
      return false;
    const location = isPageHistoryState(current.state) ? current.state.location : undefined;
    const defaultPage = configuredDefaultPage(input);
    const removedDefault =
      location?.page && location.page.extensionId === defaultPage?.extensionId && location.page.id === defaultPage?.id;
    if (
      !removedDefault &&
      new URL(current.url, "http://workbench.local").pathname.replace(/\/$/, "") !==
        `/projects/${encodeURIComponent(projectId)}`
    )
      return false;
  }
  if (eligibleDefaultPage(input)) return false;
  return batchWorkbenchChanges(() => {
    const current = input.registry.store.getState();
    const state = internals.prepare.compose(current, {
      projectId,
      activeModeId: input.modes.getActiveModeId?.() ?? selectedModeId ?? current.activeModeId,
      pageStates: current.pageStates,
      action: "unavailablePage",
    });
    const index = history.getIndex() + (operation === "push" ? 1 : 0);
    if (operation !== "none") input.browser[operation](entry(projectId, undefined, index));
    history.commitIndex(index, operation === "push");
    internals.publish(state, "unavailablePage");
    history.publish();
    return true;
  });
};

export const restoredUnavailableMode = <Value>(
  input: CreateWorkbenchPageLocationControllerInput<Value>,
  saved: PersistedWorkbenchPageLocation | undefined,
  hasProjectUrl: boolean,
) =>
  !hasProjectUrl && saved && !saved.location && saved.modeId && input.modes.getMode(saved.modeId)
    ? saved.modeId
    : undefined;
