import { Box, HStack, Text } from "@chakra-ui/react";
import { useBackendConnectionStatus } from "@/lib/sync/sync-provider";
import { useProject, useProjectTicketCount } from "../hooks/use-project";

const connectionLabel: Record<string, { label: string; color: string }> = {
  connecting: { label: "Connecting", color: "orange.solid" },
  connected: { label: "Connected", color: "green.solid" },
  error: { label: "Disconnected", color: "red.solid" },
};

export const StatusBar = (props: { projectId: string }) => {
  const { projectId } = props;
  const connection = useBackendConnectionStatus();
  const project = useProject(projectId);
  const ticketCount = useProjectTicketCount(projectId);

  const status = connectionLabel[connection] ?? connectionLabel.connecting;

  return (
    <HStack h="full" w="full" px="md" gap="md" fontSize="xs">
      <HStack gap="xs">
        <Box w="8px" h="8px" borderRadius="full" bg={status.color} />
        <Text textStyle="label/S/regular">{status.label}</Text>
      </HStack>
      <Text textStyle="label/S/regular" color="fg.muted">
        {project?.name ?? projectId}
      </Text>
      <Box flex="1" />
      <Text textStyle="label/S/regular" color="fg.muted">
        {ticketCount} tickets
      </Text>
    </HStack>
  );
};
