import { Badge, Box, Button, Grid, HStack, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import type { WorkbenchWidgetRenderInput } from "../../../core";
import { WorkbenchIcon } from "../../../react";
import { diagnosticsCommandId } from "../data";

export const DiagnosticsWidget = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;

  return (
    <ScrollArea h="full" minH="0" contentProps={{ p: "md" }}>
      <Grid templateColumns={{ base: "1fr", md: "repeat(3, minmax(0, 1fr))" }} gap="sm">
        {["Typecheck", "Lint", "Tests"].map((check) => (
          <Box key={check} borderWidth="1px" borderColor="border.subtle" borderRadius="sm" p="sm" minW="0">
            <HStack gap="xs" minW="0">
              <WorkbenchIcon name="CircleCheck" size={14} color="fg.success" />
              <Text textStyle="label/S/medium" color="fg" flex="1" minW="0" truncate>
                {check}
              </Text>
              <Badge size="sm" colorPalette="green">
                Ready
              </Badge>
            </HStack>
          </Box>
        ))}
      </Grid>
      <Button
        mt="sm"
        size="xs"
        variant="subtle"
        onClick={() => void input.workbench.commands.executeCommand(diagnosticsCommandId)}
      >
        <WorkbenchIcon name="Play" />
        Run
      </Button>
    </ScrollArea>
  );
};
