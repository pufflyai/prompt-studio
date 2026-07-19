import { Badge, HStack, Stack, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import type { ResourceRef, WorkbenchCore } from "../../core";
import { getAnchorResource } from "../../core";
import { useWorkbenchStore, WorkbenchIcon } from "../../react";

const activity = ["Primary resource synchronized", "Context panel refreshed", "Inspector state committed"];

export const ResourceActivityPanel = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const primaryResource = useWorkbenchStore(workbench.layout.store, (state) =>
    getAnchorResource(state.layout, "primary"),
  ) as ResourceRef | undefined;

  return (
    <ScrollArea h="full" bg="bg.subtle" contentProps={{ p: "md", display: "flex", flexDirection: "column", gap: "sm" }}>
      <HStack justify="space-between" gap="sm">
        <HStack gap="xs">
          <WorkbenchIcon name="PanelBottom" size={16} />
          <Text textStyle="label/S/semibold">Secondary panel</Text>
        </HStack>
        <Badge colorPalette="green">Live</Badge>
      </HStack>
      <Text textStyle="paragraph/S/regular" color="fg.muted">
        {primaryResource?.label ?? "No active resource"}
      </Text>
      <Stack gap="2xs">
        {activity.map((entry) => (
          <HStack key={entry} gap="xs">
            <WorkbenchIcon name="Check" size={14} />
            <Text textStyle="paragraph/S/regular">{entry}</Text>
          </HStack>
        ))}
      </Stack>
    </ScrollArea>
  );
};
