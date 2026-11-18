import { Button, Icon, Stack, Tag, Text } from "@chakra-ui/react";
import { AlertMessage, ScopedPopover as Popover, PopoverHeader, Portal, ScrollArea } from "@pstdio/ui";
import { Bell, TriangleAlert } from "lucide-react";
import { useLayoutEffect } from "react";
import type { WorkbenchCore } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { WorkbenchActionErrors } from "./action-errors";
import { isSystemNotice } from "./system-error-state";

export const systemActivityItemId = "workbench.system-activity";
const systemActivityTitle = "System activity";

export const useSystemActivityStatusItem = (workbench: WorkbenchCore, visible: boolean) => {
  useLayoutEffect(() => {
    if (!visible) return;
    const view = workbench.views.registerView({
      id: systemActivityItemId,
      title: systemActivityTitle,
      body: { kind: "react", render: () => <WorkbenchSystemNotices workbench={workbench} /> },
    });
    const item = workbench.statusBar.registerItem({
      id: systemActivityItemId,
      viewId: systemActivityItemId,
      slot: "leading",
      order: -1,
    });
    return () => {
      item.dispose();
      view.dispose();
    };
  }, [workbench, visible]);
};

const WorkbenchSystemNotices = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const notifications = useWorkbenchStore(workbench.notifications.store, (state) => state.notifications);
  const notices = Object.values(notifications)
    .filter(isSystemNotice)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const error = notices.find((notice) => notice.level === "error");
  const summary = error ?? notices[0];
  const errorOnly = Boolean(error) && notices.every((notice) => notice.level === "error");
  const label = errorOnly ? "System errors" : "System notices";
  const icon = error ? TriangleAlert : Bell;

  return (
    <Popover.Root variant="widget" lazyMount positioning={{ placement: "top-start", offset: { mainAxis: 4 } }}>
      <Popover.Trigger asChild>
        <Button
          size="2xs"
          variant="ghost"
          color={error ? "fg.error" : undefined}
          minW="0"
          maxW="full"
          justifyContent="flex-start"
          aria-label={summary ? `${label}: ${summary.title}` : systemActivityTitle}
        >
          <Icon as={icon} boxSize="4" />
          <Text as="span" textStyle="label/XS/medium" maxW="2xs" truncate role="status">
            {summary?.title ?? systemActivityTitle}
          </Text>
        </Button>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content
            aria-label={label}
            width="performance-popover"
            maxW="calc(100vw - var(--chakra-spacing-md) * 2)"
            maxH="70dvh"
            overflow="hidden"
          >
            <Popover.Body display="flex" flexDirection="column" minH="0">
              {/* The header stays put while the list scrolls, with its scrollbar at the popover edge. */}
              <PopoverHeader
                icon={<Icon as={icon} />}
                title={<Popover.Title>{label}</Popover.Title>}
                actions={
                  summary && (
                    <>
                      <Tag.Root
                        size="sm"
                        variant="subtle"
                        colorPalette={error ? "red" : "gray"}
                        aria-label={`${notices.length} ${label.toLowerCase()}`}
                      >
                        <Tag.Label>{notices.length}</Tag.Label>
                      </Tag.Root>
                      <Button
                        size="2xs"
                        variant="ghost"
                        onClick={() => {
                          for (const error of notices) workbench.notifications.dismiss(error.id);
                        }}
                      >
                        Clear all
                      </Button>
                    </>
                  )
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
                  {!summary && (
                    <Text color="fg.muted" textStyle="paragraph/S/regular">
                      No system notices.
                    </Text>
                  )}
                  {notices.map((error) => (
                    <AlertMessage
                      key={error.id}
                      status={error.level}
                      title={error.title}
                      closeLabel={`Dismiss ${error.title}`}
                      onClose={() => workbench.notifications.dismiss(error.id)}
                      endElement={error.actions?.map((action) => (
                        <Button
                          key={action.commandId}
                          onClick={() => {
                            const report = workbench.notifications.captureActionError(
                              action.title,
                              `system-errors.${error.id}`,
                            );
                            void workbench.commands.executeCommand(action.commandId, action.args).catch(report);
                          }}
                        >
                          {action.title}
                        </Button>
                      ))}
                    >
                      <Stack gap="xs" minW="0">
                        <Text>{error.message}</Text>
                        <WorkbenchActionErrors
                          workbench={workbench}
                          target={`system-errors.${error.id}`}
                          anchored={false}
                        />
                      </Stack>
                    </AlertMessage>
                  ))}
                </Stack>
              </ScrollArea>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
