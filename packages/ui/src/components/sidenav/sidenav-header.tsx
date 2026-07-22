import { HStack } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { PANEL_HEADER_HEIGHT } from "@/components/layout/panel-header.constants";

interface SidenavHeaderProps {
  children?: ReactNode;
}

export const SidenavHeader = (props: SidenavHeaderProps) => {
  const { children } = props;

  return (
    <HStack
      data-testid="sidenav-header"
      justify="space-between"
      align="center"
      minH={PANEL_HEADER_HEIGHT}
      bg="bg"
      position="sticky"
      top="0"
      zIndex="1"
      gap="0"
    >
      <HStack minW="0" flex="1">
        {children}
      </HStack>
    </HStack>
  );
};
