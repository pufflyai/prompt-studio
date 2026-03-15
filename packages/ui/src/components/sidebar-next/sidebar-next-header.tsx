import { HStack, IconButton } from "@chakra-ui/react";
import { PanelLeftClose } from "lucide-react";
import type { ReactNode } from "react";

interface SidebarNextHeaderProps {
  children?: ReactNode;
  onClose?: () => void;
}

export const SidebarNextHeader = (props: SidebarNextHeaderProps) => {
  const { children, onClose } = props;

  return (
    <HStack justify="space-between" align="center" px="4" py="3" bg="bg" position="sticky" top="0" zIndex="1">
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
