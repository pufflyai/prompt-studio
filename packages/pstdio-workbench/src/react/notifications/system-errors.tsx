import { Button, HStack, Icon, IconButton, Popover, Portal, Stack, Text } from "@chakra-ui/react";
import { AlertMessage, ScrollArea } from "@pstdio/ui";
import { TriangleAlert, X } from "lucide-react";
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
    <Popover.Root positioning={{ placement: "top-start", offset: { mainAxis: 4 } }}>
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
            <Popover.Body paddingX="md" paddingY="sm" display="flex" flexDirection="column" gap="sm" minH="0">
              <HStack gap="xs" flexShrink="0">
                <Icon as={TriangleAlert} boxSize="4" />
                <Popover.Title>System errors ({errors.length})</Popover.Title>
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
                viewportProps={{ role: "region", "aria-label": "System error list", overscrollBehavior: "contain" }}
              >
                <Stack gap="sm" minW="0">
                  {[...errors].reverse().map((error) => (
                    <Stack key={error.id} gap="xs" minW="0" overflowWrap="anywhere">
                      <AlertMessage
                        status="error"
                        title={
                          <HStack gap="xs" alignItems="start">
                            <Text flex="1" minW="0">
                              {error.title}
                            </Text>
                            <IconButton
                              aria-label={`Dismiss ${error.title}`}
                              size="2xs"
                              variant="ghost"
                              onClick={() => workbench.notifications.dismiss(error.id)}
                            >
                              <X />
                            </IconButton>
                          </HStack>
                        }
                      >
                        {error.message}
                      </AlertMessage>
                      {error.actions?.length ? (
                        <HStack gap="xs" flexWrap="wrap">
                          {error.actions.map((action) => (
                            <Button
                              key={action.commandId}
                              size="xs"
                              variant="outline"
                              maxW="full"
                              height="auto"
                              minH="8"
                              whiteSpace="normal"
                              overflowWrap="anywhere"
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
                        </HStack>
                      ) : null}
                      <WorkbenchActionErrors workbench={workbench} target={`system-errors.${error.id}`} />
                    </Stack>
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
