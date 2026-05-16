import { Box, type BoxProps } from "@chakra-ui/react";
import type { ReactNode } from "react";
import type { WorkbenchCore } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";

interface WorkbenchThemeScopeProps extends Omit<BoxProps, "children"> {
  workbench: WorkbenchCore;
  children: ReactNode;
}

export const WorkbenchThemeScope = (props: WorkbenchThemeScopeProps) => {
  const { workbench, children, ...boxProps } = props;
  useWorkbenchStore(workbench.theme.store, (state) => state.theme);

  return (
    <Box data-workbench-theme={workbench.theme.getTheme().id} style={workbench.theme.getCssVariables()} {...boxProps}>
      {children}
    </Box>
  );
};
