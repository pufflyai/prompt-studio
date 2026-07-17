import { Fragment, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { WorkbenchCore } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { WorkbenchClaimContext } from "./use-workbench-claim";

interface WorkbenchKeepAliveLayerProps {
  workbench: WorkbenchCore;
}

// Renders every kept-alive placement's subtree into its dedicated host element
// exactly once. Hosts use `display: contents` and are moved between widget
// slots via `renderers.claim`; React sees each placement subtree mounted once
// into a stable host, so state survives the moves. The current widget's
// `WorkbenchWidgetRenderInput` is exposed to the subtree through
// `useWorkbenchClaim()`.
export const WorkbenchKeepAliveLayer = (props: WorkbenchKeepAliveLayerProps) => {
  const { workbench } = props;
  const renderers = useWorkbenchStore(workbench.renderers.store, (state) => state.renderers);
  const hosts = useWorkbenchStore(workbench.renderers.store, (state) => state.hosts);
  const claims = useWorkbenchStore(workbench.renderers.store, (state) => state.claims);

  return (
    <Fragment>
      {Object.entries(hosts).map(([placementId, hostState]) => {
        const renderer = renderers[hostState.rendererId];
        if (!renderer?.keepAlive) return null;
        return createPortal(
          <WorkbenchClaimContext.Provider value={claims[placementId]}>
            {renderer.render() as ReactNode}
          </WorkbenchClaimContext.Provider>,
          hostState.host,
          placementId,
        );
      })}
    </Fragment>
  );
};
