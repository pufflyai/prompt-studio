import type { WorkbenchCore, WorkbenchPanelInstance } from "@pstdio/workbench";
import { resolveWebviewPageProps } from "@pstdio/workbench/extensions";
import { replaceEqualDeep } from "@tanstack/react-query";
import { useState, useSyncExternalStore } from "react";

const selectPageProps = (workbench?: WorkbenchCore, placement?: WorkbenchPanelInstance) => {
  let source = workbench?.pages.store.getState();
  let snapshot = resolveWebviewPageProps(source, placement);
  return {
    workbench,
    placement,
    get() {
      const next = workbench?.pages.store.getState();
      if (next === source) return snapshot;
      source = next;
      snapshot = replaceEqualDeep(snapshot, resolveWebviewPageProps(source, placement));
      return snapshot;
    },
    subscribe(listener: () => void) {
      return workbench?.pages.store.subscribe(listener) ?? (() => {});
    },
  };
};

export const useWebviewPageProps = (workbench?: WorkbenchCore, placement?: WorkbenchPanelInstance) => {
  const [current, setCurrent] = useState(() => selectPageProps(workbench, placement));
  let selection = current;
  if (current.workbench !== workbench || current.placement !== placement) {
    selection = selectPageProps(workbench, placement);
    setCurrent(selection);
  }
  return useSyncExternalStore(selection.subscribe, selection.get, selection.get);
};
