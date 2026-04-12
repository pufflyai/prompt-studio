import { Box, HStack, IconButton, Text } from "@chakra-ui/react";
import { useSidebarStore } from "@pstdio/ui";
import { PanelLeftOpen } from "lucide-react";
import type { ReactNode } from "react";

interface DashboardHeaderProps {
  title: ReactNode;
  sidebarStorageKey: string;
  children?: ReactNode;
}

export const DashboardHeader = (props: DashboardHeaderProps) => {
  const { title, sidebarStorageKey, children } = props;
  const sidebarOpen = useSidebarStore(sidebarStorageKey, (s) => s.open);
  const openSidebar = useSidebarStore(sidebarStorageKey, (s) => s.openSidebar);

  return (
    <HStack gap="sm" width="100%" h="41px" px="4" py="3" borderBottomWidth="1px" borderColor="border.muted">
      {!sidebarOpen ? (
        <IconButton variant="ghost" size="xs" aria-label="Show sidebar" onClick={openSidebar}>
          <PanelLeftOpen size={16} />
        </IconButton>
      ) : null}
      {typeof title === "string" ? (
        <Text textStyle="label/M/medium" flexShrink={0}>
          {title}
        </Text>
      ) : (
        <Box flexShrink={0}>{title}</Box>
      )}
      {children}
    </HStack>
  );
};
