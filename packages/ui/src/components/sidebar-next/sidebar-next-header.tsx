import { HStack, IconButton } from "@chakra-ui/react";
import { PanelLeftClose } from "lucide-react";
import type { ReactNode } from "react";

interface SidebarNextHeaderProps {
  children?: ReactNode;
  onClose: () => void;
}

export const SidebarNextHeader = (props: SidebarNextHeaderProps) => {
  const { children, onClose } = props;

  return (
    <HStack
      justify="space-between"
      align="center"
      minH="11"
      px="3"
      py="2"
      borderBottomWidth="1px"
      borderBottomColor="border.muted"
      bg="bg"
      position="sticky"
      top="0"
      zIndex="1"
    >
      <HStack minW="0" flex="1">
        {children}
      </HStack>
      <IconButton variant="ghost" size="sm" aria-label="Hide sidebar" onClick={onClose}>
        <PanelLeftClose size={16} />
      </IconButton>
    </HStack>
  );
};
