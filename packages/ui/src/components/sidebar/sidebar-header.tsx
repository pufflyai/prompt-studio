import { HStack, IconButton } from "@chakra-ui/react";
import { PanelLeftClose } from "lucide-react";
import type { ReactNode } from "react";
import { PANEL_HEADER_HEIGHT } from "../panel-header.constants";

interface SidebarHeaderProps {
  children?: ReactNode;
  onClose?: () => void;
}

export const SidebarHeader = (props: SidebarHeaderProps) => {
  const { children, onClose } = props;

  return (
    <HStack
      data-testid="sidebar-header"
      justify="space-between"
      align="center"
      minH={PANEL_HEADER_HEIGHT}
      bg="bg"
      position="sticky"
      top="0"
      zIndex="1"
    >
      <HStack minW="0" flex="1">
        {children}
      </HStack>
      {onClose ? (
        <IconButton variant="ghost" size="sm" aria-label="Hide sidebar" onClick={onClose}>
          <PanelLeftClose size={16} />
        </IconButton>
      ) : null}
    </HStack>
  );
};
