import { Spinner } from "@chakra-ui/react";
import { lazy, Suspense } from "react";
import type { WorkbenchCore, WorkbenchPanelInstance } from "../../core";

export { createControllerTerminalBridge } from "./controller-terminal-bridge";

interface WorkbenchTerminalPanelProps {
  placement: WorkbenchPanelInstance;
  workbench: WorkbenchCore;
}

const TerminalContent = lazy(() =>
  import("./workbench-terminal-content").then((module) => ({ default: module.WorkbenchTerminalContent })),
);

export const WorkbenchTerminalPanel = (props: WorkbenchTerminalPanelProps) => (
  <Suspense fallback={<Spinner />}>
    <TerminalContent {...props} />
  </Suspense>
);
