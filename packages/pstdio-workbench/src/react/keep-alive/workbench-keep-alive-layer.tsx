import { Fragment, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { WorkbenchCore } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { WorkbenchClaimContext } from "./use-workbench-claim";

interface WorkbenchKeepAliveLayerProps {
  workbench: WorkbenchCore;
}

// Renders every kept-alive renderer's subtree into its dedicated host element
// exactly once. Hosts use `display: contents` and are moved between widget
// slots via `renderers.claim`; React sees the subtree mounted once into a
// stable host, so state survives the moves. The current widget's
// `WorkbenchWidgetRenderInput` is exposed to the subtree through
// `useWorkbenchClaim()`.
export const WorkbenchKeepAliveLayer = (props: WorkbenchKeepAliveLayerProps) => {
  const { workbench } = props;
  const renderers = useWorkbenchStore(workbench.renderers.store, (state) => state.renderers);
  const hosts = useWorkbenchStore(workbench.renderers.store, (state) => state.hosts);
  const claims = useWorkbenchStore(workbench.renderers.store, (state) => state.claims);

  return (
    <Fragment>
      {Object.values(renderers).map((renderer) => {
        if (!renderer.keepAlive) return null;
        const host = hosts[renderer.id]?.host;
        if (!host) return null;
        return createPortal(
          <WorkbenchClaimContext.Provider value={claims[renderer.id]}>
            {renderer.render() as ReactNode}
          </WorkbenchClaimContext.Provider>,
          host,
          renderer.id,
        );
      })}
    </Fragment>
  );
};
