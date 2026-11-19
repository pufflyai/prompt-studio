import type { RegisteredWorkbenchNotification, WorkbenchCore } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";

export const isSystemNotice = (notice: RegisteredWorkbenchNotification) => !notice.inlineTarget;

export const useHasSystemNotices = (workbench: WorkbenchCore) =>
  useWorkbenchStore(workbench.notifications.store, (state) => Object.values(state.notifications).some(isSystemNotice));
