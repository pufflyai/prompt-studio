import { HStack, IconButton, Text } from "@chakra-ui/react";
import { useSidebarNextStore } from "@pstdio/ui";
import { PanelLeftOpen } from "lucide-react";
import type { ReactNode } from "react";

interface DashboardHeaderProps {
  title: string;
  sidebarStorageKey: string;
  children?: ReactNode;
}

export const DashboardHeader = (props: DashboardHeaderProps) => {
  const { title, sidebarStorageKey, children } = props;
  const sidebarOpen = useSidebarNextStore(sidebarStorageKey, (s) => s.open);
  const openSidebar = useSidebarNextStore(sidebarStorageKey, (s) => s.openSidebar);

  return (
    <HStack gap="sm" width="100%" px="4" py="3" borderBottomWidth="1px" borderColor="border.muted">
      {!sidebarOpen ? (
        <IconButton variant="ghost" size="xs" aria-label="Show sidebar" onClick={openSidebar}>
          <PanelLeftOpen size={16} />
        </IconButton>
      ) : null}
      <Text textStyle="label/M/medium" flexShrink={0}>
        {title}
      </Text>
      {children}
    </HStack>
  );
};
