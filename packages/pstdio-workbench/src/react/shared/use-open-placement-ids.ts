import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { WorkbenchCore } from "../../core";

const createOpenPlacementSource = (workbench: WorkbenchCore) => {
  const read = () => workbench.host.getOpenPlacementIds();
  return {
    getState: read,
    getInitialState: read,
    subscribe: (onChange: (ids: ReadonlySet<string>, previous: ReadonlySet<string>) => void) => {
      let previous = read();
      const notify = () => {
        const ids = read();
        const before = previous;
        previous = ids;
        onChange(ids, before);
      };
      const stopLayout = workbench.layout.store.subscribe(notify);
      const stopPages = workbench.pages.store.subscribe(notify);
      return () => {
        stopLayout();
        stopPages();
      };
    },
  };
};

export const useOpenPlacementIds = (workbench: WorkbenchCore) =>
  useStore(
    createOpenPlacementSource(workbench),
    useShallow((ids) => ids),
  );
