import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore } from "../../shared/store/workbench-store";
import { runWorkbenchEffect } from "../../shared/workbench-effect";

/** UI observation projects domain transitions; ordered placement reconciliation stays with its owner. */
export const createPlacementObservation = (name: string) => {
  const store = createWorkbenchStore({ name, initialState: { revision: 0 } });
  const owned = new Set<Disposable>();
  let active = true;
  return {
    get active() {
      return active;
    },
    assertActive() {
      if (!active) throw new Error("Placement registry is disposed");
    },
    publish() {
      if (active) store.setState({ revision: store.getState().revision + 1 });
    },
    subscribe(listener: () => void) {
      if (!active) return createDisposable(() => {});
      return createDisposable(store.subscribeSelector((state) => state.revision, listener));
    },
    own(release: () => void) {
      const registration = createDisposable(() => {
        owned.delete(registration);
        release();
      });
      if (active) owned.add(registration);
      else registration.dispose();
      return registration;
    },
    dispose() {
      if (!active) return;
      active = false;
      store.dispose();
      for (const registration of [...owned].reverse()) runWorkbenchEffect(name, () => registration.dispose());
      owned.clear();
    },
  };
};
