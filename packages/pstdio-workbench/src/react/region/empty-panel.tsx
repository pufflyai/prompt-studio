import { HStack, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { EmptyState, PaletteShortcut, SimpleCard, SimpleCardBody } from "@pstdio/ui";
import { useLayoutEffect, useRef } from "react";
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
  const bounds = useRef<HTMLDivElement>(null);
  const keyboard = useWorkbenchStore(workbench.keyboard.store, (state) => state);
  const panelIds = panels.map((panel) => panel.panelId).join("\0");
  useLayoutEffect(() => {
    const registration = workbench.keyboard.registerEmptyPanel(region, () => {
      const element = bounds.current;
      if (!element?.getClientRects().length) return undefined;
      const rectangle = element.getBoundingClientRect();
      return { top: rectangle.top, left: rectangle.left };
    });
    return () => registration.dispose();
  }, [workbench, region]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a change in card identities changes the numbered targets.
  useLayoutEffect(() => {
    workbench.keyboard.refresh();
  }, [workbench, panelIds]);
  const targets = workbench.keyboard.listNumberedTargets();
  const { activeModeId, modes } = useWorkbenchStore(workbench.modes.store, (state) => state);
  // A declared mode must resolve before its page and available tabs can render.
  if (!activeModeId && Object.keys(modes).length > 0) return null;
  if (!panels.length) return <EmptyState title="No tabs available" />;
  return (
    <Stack ref={bounds} flex="1" p="xl">
      <Stack w="full" maxW="lg" mx="auto">
        <SimpleGrid
          role="group"
          aria-label="Available tabs"
          gridTemplateColumns="repeat(auto-fit, minmax(min(100%, max(var(--chakra-sizes-3xs), calc((100% - var(--chakra-spacing-sm)) / 2))), 1fr))"
          gap="sm"
        >
          {panels.map((panel) => {
            const number = targets.find(
              (target) =>
                target.kind === "new-tab" && target.region === region && target.panel.panelId === panel.panelId,
            )?.number;
            return (
              <SimpleCard variant="action" asChild key={panel.panelId}>
                <button
                  type="button"
                  aria-label={panel.contribution.title}
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
                    <HStack gap="xs" justifyContent="space-between">
                      <HStack gap="xs" minW="0">
                        {panel.contribution.icon ? (
                          <WorkbenchIcon name={panel.contribution.icon} size={14} color="fg.muted" />
                        ) : null}
                        <Text textStyle="label/M/regular" truncate>
                          {panel.contribution.title}
                        </Text>
                      </HStack>
                      {number && number <= 9 ? (
                        <PaletteShortcut binding={keyboard.active ? String(number) : `Alt+Shift+${number}`} />
                      ) : null}
                    </HStack>
                  </SimpleCardBody>
                </button>
              </SimpleCard>
            );
          })}
        </SimpleGrid>
      </Stack>
    </Stack>
  );
};
