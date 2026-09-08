import { Box, Flex, Icon, IconButton, Text } from "@chakra-ui/react";
import { Bot, GitBranch, MoreHorizontal, PanelLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Header } from "@/components/layout/header";
import { PANEL_HEADER_CONTROL_SIZE } from "@/components/layout/panel-header.constants";

// Building blocks of the panel shell prototype. Not exported from the package.

export type PrototypeRadius = "xs" | "compact" | "sm" | "md";

interface PanelCardProps {
  title: string;
  description: string;
  bg: string;
  radius: PrototypeRadius;
  bordered: boolean;
}

export const PanelCard = (props: PanelCardProps) => {
  const { title, description, bg, radius, bordered } = props;

  return (
    <Flex
      direction="column"
      h="full"
      w="full"
      minH="0"
      minW="0"
      bg={bg}
      borderRadius={radius}
      borderWidth={bordered ? "1px" : "0"}
      borderColor="border.subtle"
      overflow="hidden"
    >
      <Header variant="narrow" flexShrink={0}>
        <Text textStyle="label/S/medium" color="fg" truncate>
          {title}
        </Text>
        <IconButton
          size={PANEL_HEADER_CONTROL_SIZE}
          variant="ghost"
          aria-label="Panel actions"
          marginInlineStart="auto"
        >
          <Icon as={MoreHorizontal} boxSize="14px" />
        </IconButton>
      </Header>
      <Flex flex="1" minH="0" align="center" justify="center" px="sm">
        <Text fontSize="sm" color="fg.muted" textAlign="center">
          {description}
        </Text>
      </Flex>
    </Flex>
  );
};

interface ActivityRailProps {
  sidenavCollapsed: boolean;
  onToggleSidenav: () => void;
}

export const ActivityRail = (props: ActivityRailProps) => {
  const { sidenavCollapsed, onToggleSidenav } = props;

  return (
    <Flex as="nav" direction="column" align="center" flexShrink={0} w="3.5rem" py="xs" gap="2xs">
      <IconButton
        size="sm"
        variant={sidenavCollapsed ? "ghost" : "subtle"}
        aria-label="Toggle sidenav"
        aria-pressed={!sidenavCollapsed}
        onClick={onToggleSidenav}
      >
        <Icon as={PanelLeft} boxSize="18px" />
      </IconButton>
      <IconButton size="sm" variant="ghost" aria-label="Source control">
        <Icon as={GitBranch} boxSize="18px" />
      </IconButton>
      <IconButton size="sm" variant="ghost" aria-label="Agents">
        <Icon as={Bot} boxSize="18px" />
      </IconButton>
    </Flex>
  );
};

export const StatusTray = () => (
  <Flex as="footer" align="center" flexShrink={0} h="2rem" px="sm" gap="sm">
    <Text fontSize="xs" color="fg.muted">
      main
    </Text>
    <Text fontSize="xs" color="fg.muted">
      3 files changed
    </Text>
    <Text fontSize="xs" color="fg.muted" marginInlineStart="auto">
      Claude Code · idle
    </Text>
  </Flex>
);

interface SizedSlotProps {
  width?: number;
  height?: number;
  collapsed: boolean;
  children: ReactNode;
}

export const SizedSlot = (props: SizedSlotProps) => {
  const { width, height, collapsed, children } = props;

  if (collapsed) return null;

  return (
    <Box
      flexShrink={0}
      w={width === undefined ? "full" : `${width}px`}
      h={height === undefined ? "full" : `${height}px`}
      minW="0"
      minH="0"
    >
      {children}
    </Box>
  );
};
