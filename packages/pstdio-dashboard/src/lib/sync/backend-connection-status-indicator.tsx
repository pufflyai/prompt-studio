import { HStack } from "@chakra-ui/react";
import { BackendConnectionStatusBadge } from "./backend-connection-dot";
import { useBackendConnectionStatus } from "./sync-provider";

export const BackendConnectionStatusIndicator = () => {
  const status = useBackendConnectionStatus();

  return (
    <HStack h="full" minW="0" px="sm" w="full" justify="flex-end">
      <BackendConnectionStatusBadge status={status} />
    </HStack>
  );
};
