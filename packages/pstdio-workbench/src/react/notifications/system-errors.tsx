import { Button, HStack, Icon, Stack, Tag, Text } from "@chakra-ui/react";
import { AlertMessage, ScopedPopover as Popover, Portal, ScrollArea } from "@pstdio/ui";
import { TriangleAlert } from "lucide-react";
import type { WorkbenchCore } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { WorkbenchActionErrors } from "./action-errors";
import { isSystemError } from "./system-error-state";

export const WorkbenchSystemErrors = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const notifications = useWorkbenchStore(workbench.notifications.store, (state) => state.notifications);
  const errors = Object.values(notifications)
    .filter(isSystemError)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  if (!errors.length) return null;
  const latest = errors.at(-1)!;

  return (
    <Popover.Root variant="widget" positioning={{ placement: "top-start", offset: { mainAxis: 4 } }}>
      <Popover.Trigger asChild>
        <Button
          size="2xs"
          variant="ghost"
          color="fg.error"
          minW="0"
          maxW="full"
          justifyContent="flex-start"
          aria-label={`System errors: ${latest.title}`}
        >
          <Icon as={TriangleAlert} boxSize="4" />
          <Text as="span" textStyle="label/XS/medium" maxW="2xs" truncate role="status">
            {latest.title}
          </Text>
        </Button>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content
            width="performance-popover"
            maxW="calc(100vw - var(--chakra-spacing-md) * 2)"
            maxH="70dvh"
            overflow="hidden"
          >
            <Popover.Body display="flex" flexDirection="column" minH="0">
              {/* The header stays put while the list scrolls, with its scrollbar at the popover edge. */}
              <HStack gap="xs" flexShrink="0" paddingX="sm" paddingY="xs">
                <Icon as={TriangleAlert} boxSize="4" />
                <Popover.Title>System errors</Popover.Title>
                <Tag.Root size="sm" variant="subtle" colorPalette="red" aria-label={`${errors.length} system errors`}>
                  <Tag.Label>{errors.length}</Tag.Label>
                </Tag.Root>
                <Button
                  size="2xs"
                  variant="ghost"
                  marginLeft="auto"
                  onClick={() => {
                    for (const error of errors) workbench.notifications.dismiss(error.id);
                  }}
                >
                  Clear all
                </Button>
              </HStack>
              <ScrollArea
                minH="0"
                contentProps={{ paddingX: "sm", paddingBottom: "xs" }}
                viewportProps={{ role: "region", "aria-label": "System error list", overscrollBehavior: "contain" }}
              >
                <Stack gap="sm" minW="0">
                  {[...errors].reverse().map((error) => (
                    <AlertMessage
                      key={error.id}
                      status="error"
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
                        <WorkbenchActionErrors workbench={workbench} target={`system-errors.${error.id}`} />
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
