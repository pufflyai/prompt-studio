import { IconButton } from "@chakra-ui/react";
import { useSidebarNextStore } from "@pstdio/ui";
import { PanelLeftOpen } from "lucide-react";
import { PROJECT_SIDEBAR_STORAGE_KEY } from "./project-sidebar";

export const OpenSidebarButton = () => {
  const open = useSidebarNextStore(PROJECT_SIDEBAR_STORAGE_KEY, (s) => s.open);
  const openSidebar = useSidebarNextStore(PROJECT_SIDEBAR_STORAGE_KEY, (s) => s.openSidebar);

  if (open) return null;

  return (
    <IconButton
      variant="ghost"
      size="sm"
      aria-label="Show sidebar"
      onClick={openSidebar}
      position="absolute"
      top="2"
      left="2"
      zIndex="1"
    >
      <PanelLeftOpen size={16} />
    </IconButton>
  );
};
