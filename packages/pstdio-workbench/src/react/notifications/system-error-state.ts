import type { RegisteredWorkbenchNotification, WorkbenchCore } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";

export const isSystemError = (notice: RegisteredWorkbenchNotification) =>
  notice.level === "error" && !notice.inlineTarget;

export const useHasSystemErrors = (workbench: WorkbenchCore) =>
  useWorkbenchStore(workbench.notifications.store, (state) => Object.values(state.notifications).some(isSystemError));
