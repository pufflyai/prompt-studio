import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { NotificationRow } from "@pstdio/ui";
import type { WorkbenchWidgetRenderInput } from "pstdio-workbench/react";
import { useState } from "react";
import type { NotificationInboxFilter } from "./notifications-data";
import {
  invokeNotificationAction,
  useDashboardNotificationItems,
  useDashboardSelectedProjectId,
} from "./notifications-host";

const filters: { id: NotificationInboxFilter; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "snoozed", label: "Snoozed" },
  { id: "done", label: "Done" },
  { id: "all", label: "All" },
];

export const NotificationsInboxWidget = (props: { input: WorkbenchWidgetRenderInput }) => {
  const [filter, setFilter] = useState<NotificationInboxFilter>("open");
  const projectId = useDashboardSelectedProjectId(props.input.workbench);
  const items = useDashboardNotificationItems(projectId, filter);

  return (
    <Box h="full" overflow="auto" bg="bg" p="4">
      <Stack gap="3" maxW="760px" mx="auto">
        <Box>
          <Text textStyle="heading/S" fontWeight="semibold">
            Inbox
          </Text>
          <Text textStyle="body/S" color="fg.muted">
            Durable actions that still need attention.
          </Text>
        </Box>
        <HStack gap="2" wrap="wrap">
          {filters.map((item) => (
            <Button
              key={item.id}
              size="sm"
              variant={filter === item.id ? "solid" : "outline"}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </HStack>
        {items.length === 0 ? (
          <Box border="1px solid" borderColor="border" borderRadius="md" p="6" textAlign="center">
            <Text textStyle="label/M/medium">No pending actions.</Text>
            <Text textStyle="body/S" color="fg.muted">
              Agents can keep working; anything that needs your attention will show up here.
            </Text>
          </Box>
        ) : (
          <Stack gap="1" border="1px solid" borderColor="border" borderRadius="md" overflow="hidden">
            {items.map((item) => (
              <NotificationRow
                key={item.id}
                item={item}
                onInvokeAction={(action) => invokeNotificationAction(props.input.workbench, item, action)}
              />
            ))}
          </Stack>
        )}
      </Stack>
    </Box>
  );
};
