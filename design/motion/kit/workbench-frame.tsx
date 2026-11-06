import { Box, Flex, HStack, Stack, Text } from "@chakra-ui/react";
import { Header, TreeList } from "@pstdio/ui";
import { ArrowLeft, ArrowRight, Bell, Files, GitBranch, MessageCircle, Search, Ticket } from "lucide-react";
import type { ReactNode } from "react";

export const PanelSurface = (props: { children: ReactNode; header?: ReactNode }) => {
  const { children, header } = props;
  return (
    <Flex
      direction="column"
      h="full"
      minH="0"
      minW="0"
      overflow="hidden"
      bg="bg"
      borderWidth="1px"
      borderColor="border.subtle"
      borderRadius="sm"
    >
      {header && (
        <Header h="view-bar" px="compact" gap="2xs" bg="bg.subtle" borderBottomWidth="1px" borderColor="border.subtle">
          {header}
        </Header>
      )}
      {children}
    </Flex>
  );
};

export const Navigation = () => (
  <Stack gap="0" h="full" bg="bg.subtle">
    <Header px="compact">
      <Text textStyle="label/S/medium">Prompt Studio</Text>
    </Header>
    <Box px="compact">
      <TreeList
        rowVariant="compact"
        virtualize={false}
        sections={[
          {
            id: "navigation",
            nodes: [
              { id: "search", label: "Search", icon: <Search /> },
              { id: "notifications", label: "Notifications", icon: <Bell /> },
              { id: "sessions", label: "Sessions", icon: <MessageCircle /> },
              { id: "workspaces", label: "Workspaces", icon: <Files /> },
              { id: "tickets", label: "Tickets", icon: <Ticket /> },
            ],
          },
        ]}
      />
    </Box>
  </Stack>
);

interface WorkbenchFrameProps {
  children: ReactNode;
  navigation?: ReactNode;
  side?: ReactNode;
}
export const WorkbenchFrame = (props: WorkbenchFrameProps) => {
  const { children, navigation = <Navigation />, side } = props;
  return (
    <Flex
      direction="column"
      h="full"
      minH="0"
      bg="bg"
      borderWidth="1px"
      borderColor="border"
      borderRadius="md"
      overflow="hidden"
    >
      <Flex flex="1" minH="0" p="panel-gap">
        <Box w="250px" mr="panel-gap" flexShrink="0">
          <PanelSurface>{navigation}</PanelSurface>
        </Box>
        <Flex direction="column" flex="1" minW="0" minH="0" gap="panel-gap">
          <Header h="view-bar" px="compact" bg="bg.subtle" borderRadius="sm" gap="xs">
            <ArrowLeft size={14} />
            <ArrowRight size={14} />
            <Text textStyle="label/S/regular" color="fg.muted" truncate>
              Workspace / motion-studies
            </Text>
          </Header>
          <Box flex="1" minW="0" minH="0">
            {children}
          </Box>
        </Flex>
        {side}
      </Flex>
      <HStack h="8" px="sm" gap="sm" flexShrink="0" color="fg.muted">
        <GitBranch size={14} />
        <Text textStyle="label/XS/regular">motion-studies</Text>
      </HStack>
    </Flex>
  );
};
