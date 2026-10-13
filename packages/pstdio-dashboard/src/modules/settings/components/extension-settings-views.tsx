import { Box, Stack } from "@chakra-ui/react";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench";
import { WorkbenchWidgetHost } from "@pstdio/workbench/react";
import type { DashboardExtensionMetadata } from "@/shared/extensions/types";

interface ExtensionSettingsViewsProps {
  input: WorkbenchPanelRenderInput;
  panels: DashboardExtensionMetadata["settingsPanels"];
}

export function ExtensionSettingsViews(props: ExtensionSettingsViewsProps) {
  const { input, panels } = props;
  return (
    <Stack gap="lg">
      {panels.map((panel) => (
        <Box key={panel.id} minH="0" display="flex">
          <WorkbenchWidgetHost
            workbench={input.workbench}
            placement={{
              widgetId: `${input.instance.instanceId}:${panel.id}`,
              contributionId: panel.id,
              viewId: `${panel.view.extensionId}.view.${panel.view.id}`,
              ownerId: panel.extensionId,
            }}
          />
        </Box>
      ))}
    </Stack>
  );
}
