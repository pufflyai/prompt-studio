import { createContext, useContext } from "react";
import type { WorkbenchPanelRenderInput } from "../../core";

// Set by `WorkbenchKeepAliveLayer` for each kept-alive subtree. Reflects the
// `WorkbenchPanelRenderInput` of the widget that currently has the host
// claimed, or undefined when no widget is mounted against the renderer.
export const WorkbenchClaimContext = createContext<WorkbenchPanelRenderInput | undefined>(undefined);

export const useWorkbenchClaim = () => useContext(WorkbenchClaimContext);
