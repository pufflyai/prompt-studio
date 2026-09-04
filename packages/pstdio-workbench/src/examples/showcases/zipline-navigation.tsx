import { Box, Button, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import { WorkbenchIcon } from "../../react";

const workspaceItems = [
  { icon: "Inbox", label: "Inbox", count: "4" },
  { icon: "ListTodo", label: "My issues", count: "7" },
  { icon: "Layers3", label: "Projects", count: "3" },
];

const railItems = [
  { label: "Workspace", icon: "PanelLeft" },
  { label: "Search", icon: "Search" },
  { label: "Create issue", icon: "Plus" },
  { label: "Notifications", icon: "Bell" },
];

export const ZiplineRail = () => (
  <Stack h="full" py="sm" align="center" justify="space-between">
    <Stack align="center" gap="sm">
      <Box boxSize="9" borderRadius="md" bg="bg.accent-primary.default" display="grid" placeItems="center">
        <WorkbenchIcon name="Zap" color="fg.button.primary.default" />
      </Box>
      {railItems.map((item, index) => (
        <IconButton key={item.label} aria-label={item.label} size="sm" variant={index === 0 ? "subtle" : "ghost"}>
          <WorkbenchIcon name={item.icon} />
        </IconButton>
      ))}
    </Stack>
    <Box boxSize="8" borderRadius="full" bg="bg.muted" display="grid" placeItems="center">
      <Text textStyle="paragraph/XS/semibold">MC</Text>
    </Box>
  </Stack>
);

export const WorkspaceNav = () => (
  <Stack h="full" p="sm" gap="lg">
    <HStack px="sm" py="xs" justify="space-between">
      <Stack gap="0">
        <Text textStyle="paragraph/S/semibold">Northstar</Text>
        <Text color="fg.muted" textStyle="paragraph/XS/regular">
          Product workspace
        </Text>
      </Stack>
      <WorkbenchIcon name="ChevronsUpDown" color="fg.muted" size={13} />
    </HStack>
    <Stack gap="2xs">
      <Text px="sm" textStyle="label/XS" color="fg.muted">
        WORKSPACE
      </Text>
      {workspaceItems.map((item, index) => (
        <Button key={item.label} variant={index === 1 ? "subtle" : "ghost"} size="sm" justifyContent="flex-start">
          <WorkbenchIcon name={item.icon} />
          {item.label}
          <Text ms="auto" color="fg.muted" textStyle="paragraph/XS/regular">
            {item.count}
          </Text>
        </Button>
      ))}
    </Stack>
    <Stack gap="2xs">
      <Text px="sm" textStyle="label/XS" color="fg.muted">
        TEAMS
      </Text>
      {["Product", "Platform", "Design", "Growth"].map((team) => (
        <Button key={team} variant="ghost" size="sm" justifyContent="flex-start">
          <Box boxSize="3" borderRadius="sm" bg="bg.accent-primary.default" />
          {team}
        </Button>
      ))}
    </Stack>
    <Button mt="auto" variant="ghost" size="sm" justifyContent="flex-start">
      <WorkbenchIcon name="Settings" />
      Workspace settings
    </Button>
  </Stack>
);
