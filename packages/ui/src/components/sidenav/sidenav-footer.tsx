import { Box } from "@chakra-ui/react";
import type { ReactNode } from "react";

interface SidenavFooterProps {
  children?: ReactNode;
}

export const SidenavFooter = (props: SidenavFooterProps) => {
  const { children } = props;

  if (!children) {
    return null;
  }

  return (
    <Box bg="bg" position="sticky" bottom="0" overflow="hidden">
      {children}
    </Box>
  );
};
