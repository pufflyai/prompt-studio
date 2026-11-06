import type { WorkbenchCore, WorkbenchPanelInstance } from "@pstdio/workbench";
import { resolveWebviewPageProps } from "@pstdio/workbench/extensions";
import { useEffect, useState } from "react";

export const useWebviewPageProps = (workbench?: WorkbenchCore, placement?: WorkbenchPanelInstance) => {
  const [state, setState] = useState(() => workbench?.pages.store.getState());
  useEffect(() => {
    const store = workbench?.pages.store;
    if (!store) return;
    setState(store.getState());
    return store.subscribe((next) => setState(next));
  }, [workbench]);
  return resolveWebviewPageProps(state, placement);
};
