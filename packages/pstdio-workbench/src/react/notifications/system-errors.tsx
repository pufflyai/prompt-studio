import { Button, HStack, Icon, Popover, Portal, Stack, Text } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import { TriangleAlert } from "lucide-react";
import type { WorkbenchCore } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { WorkbenchActionErrors } from "./action-errors";

export const WorkbenchSystemErrors = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const notifications = useWorkbenchStore(workbench.notifications.store, (state) => state.notifications);
  const errors = Object.values(notifications)
    .filter((notice) => notice.level === "error" && !notice.inlineTarget)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  if (!errors.length) return null;
  const latest = errors.at(-1)!;

  return (
    <Popover.Root positioning={{ placement: "top-end" }}>
      <Popover.Trigger asChild>
        <Button
          size="2xs"
          variant="ghost"
          color="fg.error"
          aria-label={`System errors (${errors.length}): ${latest.title}`}
        >
          <Icon as={TriangleAlert} boxSize="4" />
          <Text as="span" textStyle="label/XS/medium" maxW="240px" truncate role="status">
            {latest.title}
            {errors.length > 1 ? ` (${errors.length})` : ""}
          </Text>
        </Button>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content width="sm" maxW="calc(100vw - 32px)">
            <Popover.Header>
              <Popover.Title>System errors</Popover.Title>
            </Popover.Header>
            <Popover.Body>
              <Stack gap="sm" maxH="320px" overflowY="auto">
                {[...errors].reverse().map((error) => (
                  <Stack key={error.id} gap="xs">
                    <AlertMessage
                      status="error"
                      title={error.title}
                      onClose={() => workbench.notifications.dismiss(error.id)}
                    >
                      {error.message}
                    </AlertMessage>
                    {error.actions?.length ? (
                      <HStack gap="xs">
                        {error.actions.map((action) => (
                          <Button
                            key={action.commandId}
                            size="xs"
                            variant="outline"
                            onClick={() => {
                              const report = workbench.notifications.captureActionError(action.title, "system-errors");
                              void workbench.commands.executeCommand(action.commandId, action.args).catch(report);
                            }}
                          >
                            {action.title}
                          </Button>
                        ))}
                      </HStack>
                    ) : null}
                  </Stack>
                ))}
              </Stack>
              <WorkbenchActionErrors workbench={workbench} target="system-errors" />
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
