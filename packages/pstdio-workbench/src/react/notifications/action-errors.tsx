import { Box } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import { useEffect } from "react";
import type { WorkbenchCore } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";

export const WorkbenchActionErrors = (props: { workbench: WorkbenchCore; target: string }) => {
  const { workbench, target } = props;
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
  return (
    <Box flexShrink={0} p="xs" data-action-error-target={target}>
      {errors.map((error) => (
        <AlertMessage
          key={error.id}
          status="error"
          role="alert"
          title={error.title}
          onClose={() => workbench.notifications.dismiss(error.id)}
        >
          {error.message}
        </AlertMessage>
      ))}
    </Box>
  );
};
