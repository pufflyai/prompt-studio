import { createWorkbenchStore } from "./shared/store/workbench-store";

/** The host activates one workbench per window. Hidden workbenches keep running. */
export const createWorkbenchActivation = (active = true) => {
  const store = createWorkbenchStore({ name: "workbench.activation", initialState: { active } });
  return {
    store,
    isActive: () => store.getState().active,
    setActive(active: boolean) {
      if (active !== store.getState().active) store.setState({ active }, false, "setActive");
    },
  };
};
export type WorkbenchActivation = ReturnType<typeof createWorkbenchActivation>;
