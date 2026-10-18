import type { WorkbenchCore } from "@pstdio/workbench";
import { resolvePageParams } from "pstdio-api-contracts";
import { useEffect, useState } from "react";

export const useWebviewPageProps = (workbench?: WorkbenchCore) => {
  const [state, setState] = useState(() => workbench?.pages.store.getState());
  useEffect(() => {
    const store = workbench?.pages.store;
    if (!store) return;
    setState(store.getState());
    return store.subscribe((next) => setState(next));
  }, [workbench]);
  const page = state?.activePageId && state.pages[state.activePageId];
  return {
    pageLocation: state?.location,
    pageParams: resolvePageParams(page ? page.params : undefined, state?.location?.params),
  };
};
