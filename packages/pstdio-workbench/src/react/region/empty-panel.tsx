import { HStack, SimpleGrid, Text } from "@chakra-ui/react";
import { EmptyState, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import type { WorkbenchCore, WorkbenchPanelRegion } from "../../core";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchCompositionPanels } from "../shared/use-workbench-composition-panels";
import { useWorkbenchLocationResource } from "../shared/use-workbench-location-resource";
import { openPanelWidget } from "./panel-widget-open";

interface EmptyPanelProps {
  workbench: WorkbenchCore;
  region: WorkbenchPanelRegion;
}

export const EmptyPanel = (props: EmptyPanelProps) => {
  const { workbench, region } = props;
  const resource = useWorkbenchLocationResource(workbench);
  const panels = useWorkbenchCompositionPanels(workbench)[region].addable;
  if (!panels.length) return <EmptyState title="No tabs available" />;
  return (
    <SimpleGrid
      role="group"
      aria-label="Available tabs"
      gridTemplateColumns="repeat(auto-fit, minmax(min(100%, var(--chakra-sizes-3xs)), 1fr))"
      gap="md"
      p="md"
      w="full"
      maxW="4xl"
      mx="auto"
    >
      {panels.map((panel) => (
        <SimpleCard asChild key={panel.panelId} textAlign="left" cursor="pointer" focusVisibleRing="outside">
          <button
            type="button"
            onClick={() =>
              openPanelWidget({
                workbench,
                widget: panel.contribution,
                region,
                resource,
                pinned: panel.pinned,
                open: panel.open,
              })
            }
          >
            <SimpleCardBody>
              <HStack gap="sm">
                {panel.contribution.icon ? <WorkbenchIcon name={panel.contribution.icon} size={16} /> : null}
                <Text textStyle="label/S/medium" truncate>
                  {panel.contribution.title}
                </Text>
              </HStack>
            </SimpleCardBody>
          </button>
        </SimpleCard>
      ))}
    </SimpleGrid>
  );
};
