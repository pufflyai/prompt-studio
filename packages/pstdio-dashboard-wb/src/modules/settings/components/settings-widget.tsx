import { Box } from "@chakra-ui/react";
import type { WorkbenchWidgetRenderInput } from "pstdio-workbench/react";
import { WorkbenchSettingsPanel } from "./workbench-settings-panel";

export const SettingsWidget = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;

  return (
    <Box h="full" minH="0" overflow="hidden">
      <WorkbenchSettingsPanel input={input} />
    </Box>
  );
};
