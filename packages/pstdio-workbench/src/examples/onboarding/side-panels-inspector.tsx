import { Badge, Code, HStack, Stack, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import { getAnchorResource, type WorkbenchCore } from "../../core";
import { useWorkbenchStore, WorkbenchIcon } from "../../react";
import { findSidePanelItem } from "./side-panels-data";

interface ResourceInspectorProps {
  workbench: WorkbenchCore;
  detailWidgetId: string;
}

export const ResourceInspector = (props: ResourceInspectorProps) => {
  const { detailWidgetId, workbench } = props;
  const primaryResource = useWorkbenchStore(workbench.layout.store, (state) =>
    getAnchorResource(state.layout, "primary"),
  );
  const item = findSidePanelItem(primaryResource);
  const mainPlacements = useWorkbenchStore(workbench.layout.store, (state) => state.layout.regions.main.widgets);
  const detailTabs = mainPlacements.filter((placement) => placement.contributionId === detailWidgetId);

  return (
    <ScrollArea h="full" bg="bg.subtle" contentProps={{ p: "md", display: "flex", flexDirection: "column", gap: "md" }}>
      <Stack gap="2xs">
        <Text textStyle="label/S/semibold" color="fg.muted">
          Inspector
        </Text>
        <Text textStyle="title/S/semibold">{item.label}</Text>
        <Code colorPalette="gray" whiteSpace="normal">
          {primaryResource?.uri}
        </Code>
      </Stack>

      <Stack gap="xs">
        <Text textStyle="label/S/semibold">Resource facts</Text>
        <HStack justify="space-between" gap="sm">
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            Status
          </Text>
          <Badge colorPalette="blue">{item.status}</Badge>
        </HStack>
        <HStack justify="space-between" gap="sm">
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            Owner
          </Text>
          <Text textStyle="paragraph/S/semibold">{item.owner}</Text>
        </HStack>
      </Stack>

      <Stack gap="xs">
        <Text textStyle="label/S/semibold">Open detail tabs</Text>
        {detailTabs.map((placement) => (
          <HStack key={placement.widgetId} gap="xs" minW="0">
            <WorkbenchIcon name="FileText" size={14} />
            <Text textStyle="paragraph/S/regular" minW="0" truncate>
              {placement.title ?? placement.resource?.label ?? placement.widgetId}
            </Text>
          </HStack>
        ))}
      </Stack>
    </ScrollArea>
  );
};
