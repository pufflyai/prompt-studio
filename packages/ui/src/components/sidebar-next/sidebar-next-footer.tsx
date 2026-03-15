import { Box } from "@chakra-ui/react";
import type { ReactNode } from "react";

interface SidebarNextFooterProps {
  children?: ReactNode;
}

export const SidebarNextFooter = (props: SidebarNextFooterProps) => {
  const { children } = props;

  if (!children) {
    return null;
  }

  return (
    <Box px="2" py="2" bg="bg" position="sticky" bottom="0" overflow="hidden">
      {children}
    </Box>
  );
};
