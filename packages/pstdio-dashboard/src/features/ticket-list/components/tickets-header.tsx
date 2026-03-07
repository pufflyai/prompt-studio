import { HStack, Text } from "@chakra-ui/react";

export const TicketsHeader = () => {
  return (
    <HStack gap="sm" width="100%" px="4" py="3" borderBottomWidth="1px" borderColor="border.muted">
      <Text textStyle="label/M/medium">Tickets</Text>
    </HStack>
  );
};
