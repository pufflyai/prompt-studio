import { Box } from "@chakra-ui/react";
import type { WorkbenchWidgetRenderInput } from "../../../../../react";
import { WebviewPlaceholder } from "../../../shared/components/webview-placeholder";

export const SettingsWidget = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  const title = input.placement.resource?.label ?? "Project settings";
  const isExtensionSettings = input.placement.resource?.id?.startsWith("settings/lab") === true;

  return (
    <Box h="full" minH="0" p="md">
      <WebviewPlaceholder
        slotId="project.settingsPanels.webview"
        title={title}
        contributor={isExtensionSettings ? "extension-lab" : "pstdio"}
        entry={isExtensionSettings ? "lab-settings.tsx" : "project-settings.tsx"}
        icon={input.placement.resource?.icon ?? "Settings"}
        height="100%"
      />
    </Box>
  );
};
