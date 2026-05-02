import { Box, IconButton, Text } from "@chakra-ui/react";
import { Header, useSidebarStore } from "@pstdio/ui";
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
    <Header variant="main" gap="sm" width="100%" borderBottomWidth="1px" borderColor="border.muted">
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
    </Header>
  );
};
