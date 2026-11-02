import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import { batchWorkbenchChanges } from "../../shared/store/workbench-batch";
import type { createPageLocationHistory } from "./page-location-history-entry";
import type { CreateWorkbenchPageLocationControllerInput, WorkbenchPageBrowserEntry } from "./page-location-types";
import { isPageHistoryState } from "./page-url-resolver";

interface EmptyRootHistoryState {
  kind: "pstdio.empty-page-location";
  projectId: string;
  modeId?: string;
  index: number;
}
const emptyRootState = (entry: WorkbenchPageBrowserEntry): EmptyRootHistoryState | undefined => {
  const state = entry.state as Partial<EmptyRootHistoryState> | undefined;
  if (
    state?.kind !== "pstdio.empty-page-location" ||
    typeof state.projectId !== "string" ||
    typeof state.index !== "number"
  )
    return undefined;
  if (
    new URL(entry.url, "http://workbench.local").pathname.replace(/\/$/, "") !==
    `/projects/${encodeURIComponent(state.projectId)}`
  )
    return undefined;
  return state as EmptyRootHistoryState;
};

// Empty mode navigation uses the same browser commit boundary as page navigation.
// It has a history entry, but contributes no page, placeholder, or provider policy.
export const createEmptyRootLocation = <Value>(
  input: Pick<CreateWorkbenchPageLocationControllerInput<Value>, "registry" | "browser" | "startPage">,
  history: ReturnType<typeof createPageLocationHistory>,
) => {
  const publish = (replay?: EmptyRootHistoryState) =>
    batchWorkbenchChanges(() => {
      const internals = getWorkbenchPageRegistryInternals(input.registry);
      const current = input.registry.store.getState();
      const action = "navigateToEmptyRootLevel";
      const state = internals.prepare.compose(current, {
        pageStates: current.pageStates,
        projectId: current.projectId,
        activeModeId: replay?.modeId ?? current.activeModeId,
        action,
      });
      const index = replay?.index ?? history.getIndex() + 1;
      if (!replay)
        input.browser.push({
          url: `/projects/${encodeURIComponent(current.projectId!)}`,
          state: {
            kind: "pstdio.empty-page-location",
            projectId: current.projectId!,
            modeId: state.activeModeId,
            index,
          } satisfies EmptyRootHistoryState,
        });
      history.commitIndex(index, !replay);
      internals.publish(state, action);
      history.publish();
    });
  const replay = (entry: WorkbenchPageBrowserEntry) => {
    const state = emptyRootState(entry);
    if (!state || state.projectId !== input.registry.store.getState().projectId) return false;
    // If the default became available, resolve the ordinary project root again.
    if (
      input.registry
        .listPages()
        .some((page) => page.ref.extensionId === input.startPage.extensionId && page.ref.id === input.startPage.id)
    ) {
      history.adopt(state.index);
      return false;
    }
    publish(state);
    return true;
  };
  return {
    adopt(entry: WorkbenchPageBrowserEntry, projectId: string) {
      const state = isPageHistoryState(entry.state) ? entry.state : emptyRootState(entry);
      if (state?.projectId === projectId) history.adopt(state.index);
      else history.reset();
    },
    navigate: () => publish(),
    withReplay:
      (next: (entry: WorkbenchPageBrowserEntry) => void, fail: (error: unknown) => unknown) =>
      (entry: WorkbenchPageBrowserEntry) => {
        try {
          if (!replay(entry)) next(entry);
        } catch (error) {
          fail(error);
        }
      },
  };
};
