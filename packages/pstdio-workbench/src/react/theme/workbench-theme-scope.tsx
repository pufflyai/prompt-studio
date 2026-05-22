import { Box, type BoxProps } from "@chakra-ui/react";
import type { ReactNode } from "react";

interface WorkbenchThemeScopeProps extends Omit<BoxProps, "children"> {
  children: ReactNode;
}

export const WorkbenchThemeScope = (props: WorkbenchThemeScopeProps) => {
  const { children, ...boxProps } = props;

  return <Box {...boxProps}>{children}</Box>;
};
