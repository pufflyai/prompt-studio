import { IconButton } from "@chakra-ui/react";
import { useSidebarStore } from "@pstdio/ui";
import { PanelLeftOpen } from "lucide-react";
import { PROJECT_SIDEBAR_STORAGE_KEY } from "./project-sidebar";

interface OpenSidebarButtonProps {
  storageKey?: string;
  size?: "xs" | "sm";
}

export const OpenSidebarButton = (props: OpenSidebarButtonProps) => {
  const { storageKey = PROJECT_SIDEBAR_STORAGE_KEY, size = "xs" } = props;
  const open = useSidebarStore(storageKey, (s: { open: boolean }) => s.open);
  const openSidebar = useSidebarStore(storageKey, (s: { openSidebar: () => void }) => s.openSidebar);

  if (open) return null;

  return (
    <IconButton variant="ghost" size={size} aria-label="Show sidebar" onClick={openSidebar} flexShrink={0}>
      <PanelLeftOpen size={16} />
    </IconButton>
  );
};
