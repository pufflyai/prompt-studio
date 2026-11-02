import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import type { CreateWorkbenchPageLocationControllerInput } from "./page-location-types";

export const createEmptyRootLocation =
  <Value>(
    input: Pick<CreateWorkbenchPageLocationControllerInput<Value>, "registry" | "browser">,
    resetHistory: () => void,
  ) =>
  () => {
    const internals = getWorkbenchPageRegistryInternals(input.registry);
    const state = input.registry.store.getState();
    const action = "navigateToEmptyRootLevel";
    internals.publish(
      internals.prepare.compose(state, {
        pageStates: state.pageStates,
        projectId: state.projectId,
        activeModeId: state.activeModeId,
        action,
      }),
      action,
    );
    input.browser.replace({ url: `/projects/${encodeURIComponent(state.projectId!)}` });
    resetHistory();
  };
