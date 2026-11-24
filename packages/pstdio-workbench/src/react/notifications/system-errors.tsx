import { Button, HStack, Icon, Stack, Tag, Text } from "@chakra-ui/react";
import { AlertMessage, PopoverHeader, ScrollArea } from "@pstdio/ui";
import { Bell, TriangleAlert } from "lucide-react";
import { useLayoutEffect } from "react";
import type { WorkbenchCore } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { WorkbenchActionErrors } from "./action-errors";
import { OperationProgressIndicator, OperationRecoveryItem, useOperationActivity } from "./operation-recovery";
import { isSystemNotice } from "./system-error-state";

export const systemActivityItemId = "workbench.system-activity";
const detailsViewId = `${systemActivityItemId}.details`;

export const useSystemActivityStatusItem = (workbench: WorkbenchCore, visible: boolean) => {
  const { summary, label } = useSystemNotices(workbench);
  const hasNotices = Boolean(summary);
  useLayoutEffect(() => {
    if (!visible || !hasNotices) return;
    const view = workbench.views.registerView({
      id: systemActivityItemId,
      title: "System activity",
      body: { kind: "react", render: () => <SystemNoticeIndicator workbench={workbench} /> },
    });
    const details = workbench.views.registerView({
      id: detailsViewId,
      title: "System notices",
      body: { kind: "react", render: () => <WorkbenchSystemNotices workbench={workbench} /> },
    });
    const item = workbench.statusBar.registerItem({
      id: systemActivityItemId,
      viewId: systemActivityItemId,
      popoverViewId: detailsViewId,
      slot: "leading",
    });
    return () => {
      item.dispose();
      details.dispose();
      view.dispose();
    };
  }, [workbench, visible, hasNotices]);
  return summary ? `${label}: ${summary.title}` : "";
};

const useSystemNotices = (workbench: WorkbenchCore) => {
  const notifications = useWorkbenchStore(workbench.notifications.store, (state) => state.notifications);
  const { pending, recovery } = useOperationActivity(workbench);
  const notices = Object.values(notifications)
    .filter(isSystemNotice)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const error = notices.find((notice) => notice.level === "error") ?? recovery[0];
  const errorOnly = Boolean(error) && notices.every((notice) => notice.level === "error");
  const normalLabel = notices.length ? "System notices" : "System activity";
  return {
    notices,
    pending,
    recovery,
    summary: error ?? notices[0] ?? pending[0],
    label: errorOnly ? "System errors" : normalLabel,
    error,
    errorOnly,
  };
};

const SystemNoticeIndicator = ({ workbench }: { workbench: WorkbenchCore }) => {
  const { summary, error } = useSystemNotices(workbench);
  if (summary && "showPending" in summary) return <OperationProgressIndicator title={summary.title} />;
  return (
    <HStack gap="xs" minW="0" color={error ? "fg.error" : undefined}>
      <Icon as={error ? TriangleAlert : Bell} boxSize="4" />
      <Text as="span" textStyle="label/XS/medium" maxW="2xs" truncate>
        {summary?.title}
      </Text>
    </HStack>
  );
};

const WorkbenchSystemNotices = ({ workbench }: { workbench: WorkbenchCore }) => {
  const { notices, pending, recovery, label, error, errorOnly } = useSystemNotices(workbench);
  const count = notices.length + recovery.length + pending.length;
  return (
    <>
      <PopoverHeader
        icon={<Icon as={error ? TriangleAlert : Bell} />}
        title={label}
        actions={
          <>
            <Tag.Root
              size="sm"
              variant="subtle"
              colorPalette={error ? "red" : "gray"}
              aria-label={`${count} ${label.toLowerCase()}`}
            >
              <Tag.Label>{count}</Tag.Label>
            </Tag.Root>
            <Button
              size="2xs"
              disabled={notices.length === 0}
              variant="ghost"
              onClick={() => {
                for (const notice of notices) workbench.notifications.dismiss(notice.id);
              }}
            >
              Clear all
            </Button>
          </>
        }
      />
      <ScrollArea
        minH="0"
        contentProps={{ paddingX: "sm", paddingBottom: "xs" }}
        viewportProps={{
          role: "region",
          "aria-label": errorOnly ? "System error list" : "System notice list",
          overscrollBehavior: "contain",
        }}
      >
        <Stack gap="sm" minW="0">
          {pending.map((entry) => (
            <OperationProgressIndicator key={entry.id.description} title={entry.title} />
          ))}
          {recovery.map((entry) => (
            <OperationRecoveryItem key={entry.id.description} workbench={workbench} entry={entry} />
          ))}
          {notices.map((notice) => (
            <AlertMessage
              key={notice.id}
              status={notice.level}
              title={notice.title}
              closeLabel={`Dismiss ${notice.title}`}
              onClose={() => workbench.notifications.dismiss(notice.id)}
              endElement={notice.actions?.map((action) => (
                <Button
                  key={action.commandId}
                  onClick={() => {
                    const report = workbench.notifications.captureActionError(
                      action.title,
                      `system-errors.${notice.id}`,
                    );
                    void workbench.commands.executeCommand(action.commandId, action.args).catch(report);
                  }}
                >
                  {action.title}
                </Button>
              ))}
            >
              <Stack gap="xs" minW="0">
                <Text>{notice.message}</Text>
                <WorkbenchActionErrors workbench={workbench} target={`system-errors.${notice.id}`} anchored={false} />
              </Stack>
            </AlertMessage>
          ))}
        </Stack>
      </ScrollArea>
    </>
  );
};
