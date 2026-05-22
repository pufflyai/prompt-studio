import { Box, HStack, Text } from "@chakra-ui/react";
import type { WorkbenchWidgetRenderInput } from "../../../../../react";
import { WorkbenchIcon } from "../../../../../react";
import { dashboardTickets } from "../../../shared/mock-data/tickets";

export const StatusWidget = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;

  return (
    <HStack h="full" gap="md" px="sm" minW="0">
      <HStack gap="xs">
        <WorkbenchIcon name="KanbanSquare" size={13} />
        <Text textStyle="label/XS/regular">{dashboardTickets.length} tickets</Text>
      </HStack>
      <HStack gap="xs">
        <WorkbenchIcon name="Puzzle" size={13} />
        <Text textStyle="label/XS/regular">{input.workbench.commands.listCommands().length} commands</Text>
      </HStack>
      <Box flex="1" />
      <Text textStyle="label/XS/regular" color="fg.muted" truncate>
        dashboard-workbench story
      </Text>
    </HStack>
  );
};
