import { Fragment, type ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import type { WorkbenchCore } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { registerWorkbenchKeepAliveSlotRenderer } from "./keep-alive-slot";

interface WorkbenchKeepAliveLayerProps {
  workbench: WorkbenchCore;
}

// Renders every registered keep-alive subtree into its dedicated host element.
// The hosts use `display: contents` and are moved between slots via
// `keepAlive.claim`; React only ever sees the subtree mounted once into a
// stable host, so subtree state survives those moves. Also installs the
// built-in `keep-alive-slot` widget renderer that bridge widgets use to claim.
export const WorkbenchKeepAliveLayer = (props: WorkbenchKeepAliveLayerProps) => {
  const { workbench } = props;
  const registrations = useWorkbenchStore(workbench.keepAlive.store, (state) => state.registrations);

  useEffect(() => {
    const disposable = registerWorkbenchKeepAliveSlotRenderer(workbench);
    return () => disposable?.dispose();
  }, [workbench]);

  return (
    <Fragment>
      {Object.values(registrations).map((registration) =>
        createPortal(registration.render() as ReactNode, registration.host, registration.id),
      )}
    </Fragment>
  );
};
