import { HStack, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { EmptyState, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import type { WorkbenchCore, WorkbenchPanelRegion } from "../../core";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchCompositionPanels } from "../shared/use-workbench-composition-panels";
import { useWorkbenchLocationResource } from "../shared/use-workbench-location-resource";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { openPanelWidget } from "./panel-widget-open";

interface EmptyPanelProps {
  workbench: WorkbenchCore;
  region: WorkbenchPanelRegion;
}

export const EmptyPanel = (props: EmptyPanelProps) => {
  const { workbench, region } = props;
  const resource = useWorkbenchLocationResource(workbench);
  const panels = useWorkbenchCompositionPanels(workbench)[region].addable;
  const { activeModeId, modes } = useWorkbenchStore(workbench.modes.store, (state) => state);
  // A declared mode must resolve before its page and available tabs can render.
  if (!activeModeId && Object.keys(modes).length > 0) return null;
  if (!panels.length) return <EmptyState title="No tabs available" />;
  return (
    <Stack p="md" w="full" maxW="4xl" mx="auto" gap="md">
      <Text textStyle="label/M/medium">Tools</Text>
      <SimpleGrid
        role="group"
        aria-label="Available tabs"
        gridTemplateColumns="repeat(auto-fit, minmax(min(100%, max(var(--chakra-sizes-3xs), calc((100% - var(--chakra-spacing-sm)) / 2))), 1fr))"
        gap="sm"
      >
        {panels.map((panel) => (
          <SimpleCard variant="action" asChild key={panel.panelId}>
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
                <HStack gap="xs">
                  {panel.contribution.icon ? (
                    <WorkbenchIcon name={panel.contribution.icon} size={14} color="fg.muted" />
                  ) : null}
                  <Text textStyle="label/M/regular" truncate>
                    {panel.contribution.title}
                  </Text>
                </HStack>
              </SimpleCardBody>
            </button>
          </SimpleCard>
        ))}
      </SimpleGrid>
    </Stack>
  );
};
