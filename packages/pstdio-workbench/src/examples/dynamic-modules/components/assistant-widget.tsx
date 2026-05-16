import { Stack } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import { InventoryRow, Panel } from "./panel";

export const AssistantWidget = () => (
  <ScrollArea h="full" minH="0" contentProps={{ p: "md" }}>
    <Stack data-assistant-widget="true" gap="sm">
      <Panel title="Assistant">
        <Stack gap="xs">
          <InventoryRow icon="Bot" label="Runtime" value="attached" />
          <InventoryRow icon="MessageSquare" label="Channel" value="extension" />
        </Stack>
      </Panel>
    </Stack>
  </ScrollArea>
);
