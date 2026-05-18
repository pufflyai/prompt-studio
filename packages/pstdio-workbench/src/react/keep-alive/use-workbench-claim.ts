import { createContext, useContext } from "react";
import type { WorkbenchWidgetRenderInput } from "../../core";

// Set by `WorkbenchKeepAliveLayer` for each kept-alive subtree. Reflects the
// `WorkbenchWidgetRenderInput` of the widget that currently has the host
// claimed, or undefined when no widget is mounted against the renderer.
export const WorkbenchClaimContext = createContext<WorkbenchWidgetRenderInput | undefined>(undefined);

export const useWorkbenchClaim = () => useContext(WorkbenchClaimContext);
