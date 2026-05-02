import { Box } from "@chakra-ui/react";
import type { ReactNode } from "react";

interface SidebarFooterProps {
  children?: ReactNode;
}

export const SidebarFooter = (props: SidebarFooterProps) => {
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
