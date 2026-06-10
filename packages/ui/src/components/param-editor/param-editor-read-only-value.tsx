import { Box, type BoxProps } from "@chakra-ui/react";
import type { ReactNode } from "react";

interface ParamEditorReadOnlyValueProps extends Omit<BoxProps, "children"> {
  children: ReactNode;
  preserveWhitespace?: boolean;
}

export const ParamEditorReadOnlyValue = (props: ParamEditorReadOnlyValueProps) => {
  const { children, preserveWhitespace = false, ...boxProps } = props;

  return (
    <Box minW="0" textStyle="label/S/regular" whiteSpace={preserveWhitespace ? "pre-wrap" : undefined} {...boxProps}>
      {children}
    </Box>
  );
};
