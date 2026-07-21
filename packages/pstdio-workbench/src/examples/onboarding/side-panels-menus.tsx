import { Stack, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import type { WorkbenchModuleContributionContext, WorkbenchPanelMenuRegion } from "../../core";
import { WorkbenchIcon } from "../../react";

const RENDERER_ID = "onboarding.side-panels.panel-menu.renderer";

const menuExamples: Array<{
  id: string;
  title: string;
  icon: string;
  region: WorkbenchPanelMenuRegion;
}> = [
  { id: "main-properties", title: "Properties", icon: "SlidersHorizontal", region: "main-right-menu" },
  { id: "secondary-runs", title: "Runs", icon: "ListTree", region: "secondary-left-menu" },
  { id: "secondary-problems", title: "Problems", icon: "CircleAlert", region: "secondary-right-menu" },
  { id: "side-files", title: "Files", icon: "Folder", region: "side-left-menu" },
  { id: "side-tools", title: "Tools", icon: "SlidersHorizontal", region: "side-right-menu" },
];

export const registerSidePanelMenuExamples = (ctx: WorkbenchModuleContributionContext) => {
  ctx.renderers.registerRenderer({
    id: RENDERER_ID,
    render: ({ placement }) => (
      <ScrollArea
        h="full"
        bg="bg.subtle"
        contentProps={{ p: "md", display: "flex", flexDirection: "column", gap: "sm" }}
      >
        <Stack gap="xs">
          <WorkbenchIcon name="PanelRight" size={16} />
          <Text textStyle="label/S/semibold">{placement.title}</Text>
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            This menu belongs to its surrounding Panel.
          </Text>
        </Stack>
      </ScrollArea>
    ),
  });

  for (const menu of menuExamples) {
    const widgetId = `onboarding.side-panels.${menu.id}`;
    ctx.layout.registerWidget({
      id: widgetId,
      title: menu.title,
      icon: menu.icon,
      region: menu.region,
      regionSize: { defaultPx: 180, minPx: 144, maxPx: 320 },
      singleton: true,
      rendererId: RENDERER_ID,
    });
    ctx.layout.openWidget(widgetId, { pinned: true });
  }
};
