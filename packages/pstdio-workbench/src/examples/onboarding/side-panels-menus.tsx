import { Stack, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import type { WorkbenchModuleContext, WorkbenchPanelMenuDefinition } from "../../core";
import { WorkbenchIcon } from "../../react";

const RENDERER_ID = "onboarding.side-panels.panel-menu.renderer";

const panelMenu = (
  id: string,
  title: string,
  icon: string,
  side: WorkbenchPanelMenuDefinition["side"],
): WorkbenchPanelMenuDefinition => ({
  id: `onboarding.side-panels.${id}`,
  title,
  icon,
  side,
  regionSize: { defaultPx: 180, minPx: 144, maxPx: 320 },
  singleton: true,
  rendererId: RENDERER_ID,
});

export const sidePanelMenuDefinitions = {
  location: [panelMenu("main-inspector", "Inspector", "SlidersHorizontal", "right")],
  activity: [
    panelMenu("secondary-runs", "Runs", "ListTree", "left"),
    panelMenu("secondary-problems", "Problems", "CircleAlert", "right"),
  ],
  inspector: [
    panelMenu("side-files", "Files", "Folder", "left"),
    panelMenu("side-tools", "Tools", "SlidersHorizontal", "right"),
  ],
} satisfies Record<string, WorkbenchPanelMenuDefinition[]>;

export const registerSidePanelMenuExamples = (ctx: WorkbenchModuleContext) => {
  ctx.renderers.registerRenderer({
    id: RENDERER_ID,
    render: ({ instance }) => (
      <ScrollArea
        h="full"
        bg="bg.subtle"
        contentProps={{ p: "md", display: "flex", flexDirection: "column", gap: "sm" }}
      >
        <Stack gap="xs">
          <WorkbenchIcon name="PanelRight" size={16} />
          <Text textStyle="label/S/semibold">{instance.title}</Text>
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            This menu belongs to its surrounding Panel.
          </Text>
        </Stack>
      </ScrollArea>
    ),
  });
};
