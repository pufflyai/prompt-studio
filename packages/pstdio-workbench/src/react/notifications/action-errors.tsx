import { ActionErrorSlot, AlertMessage } from "@pstdio/ui";
import { useEffect } from "react";
import type { WorkbenchCore } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";

export const WorkbenchActionErrors = (props: {
  workbench: WorkbenchCore;
  target: string;
  edge?: "above";
  anchored?: boolean;
}) => {
  const { workbench, target, edge, anchored = true } = props;
  const notifications = useWorkbenchStore(workbench.notifications.store, (state) => state.notifications);
  const errors = Object.values(notifications).filter((notice) => notice.inlineTarget === target);

  useEffect(
    () => () => {
      for (const notice of workbench.notifications.listNotifications()) {
        if (notice.inlineTarget === target) workbench.notifications.dismiss(notice.id);
      }
    },
    [workbench, target],
  );

  if (!errors.length) return null;
  const notices = errors.map((error) => (
    <AlertMessage
      key={error.id}
      data-action-error-target={target}
      compact
      status="error"
      role="alert"
      title={error.title}
      onClose={() => workbench.notifications.dismiss(error.id)}
    >
      {error.message}
    </AlertMessage>
  ));
  return anchored ? <ActionErrorSlot edge={edge}>{notices}</ActionErrorSlot> : notices;
};
