import { Box, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { createDashboardResource } from "@/shared/app/resources";
import type { RecentProjectResource } from "@/shared/recents/recent-project-resources";
import { StartAboutPanel } from "./start-about-panel";
import { type StartAction, StartActionList } from "./start-action-list";
import { StartRecentList } from "./start-recent-list";

const recentResource = (
  id: string,
  title: string,
  kindLabel: string,
  icon: string,
  updatedAt: string,
): RecentProjectResource => ({
  id,
  title,
  kindLabel,
  icon,
  updatedAt,
  resource: createDashboardResource(kindLabel.toLowerCase(), id, title, icon, "project-1"),
});

const resources: RecentProjectResource[] = [
  recentResource(
    "session-1",
    "Make the weekly report easier to scan",
    "Session",
    "message-circle",
    "2026-06-16T14:24:00.000Z",
  ),
  recentResource("ticket-1", "PS-231 Persistent project tabs", "Ticket", "component", "2026-06-16T11:02:00.000Z"),
  recentResource("artifact-1", "Weekly activity summary", "Artifact", "file-code", "2026-06-15T09:10:00.000Z"),
  recentResource("workspace-1", "PS-231_A1", "Workspace", "computer", "2026-06-14T17:45:00.000Z"),
];

const actions: StartAction[] = [
  { id: "new-conversation", label: "New conversation", icon: "message-square", run: () => undefined },
  { id: "open-tool", label: "Open a tool", icon: "panels-top-left", run: () => undefined },
  { id: "browse-extensions", label: "Browse extensions", icon: "blocks", run: () => undefined },
];

const StartPagePreview = () => (
  <Stack w="full" maxW="52rem" pt="4xl" pb="3xl" gap="3xl">
    <Stack gap="xs" minW="0">
      <Text textStyle="heading/M">Prompt Studio</Text>
      <Text textStyle="paragraph/M/regular" color="fg.muted">
        Project home
      </Text>
    </Stack>
    <StartAboutPanel />
    <Stack direction={{ base: "column", md: "row" }} gap={{ base: "3xl", md: "4xl" }} align="flex-start" minW="0">
      <Box flex="1" minW="0" w="full">
        <StartActionList actions={actions} />
      </Box>
      <Box flex="1" minW="0" w="full">
        <StartRecentList resources={resources} onOpen={() => undefined} />
      </Box>
    </Stack>
  </Stack>
);

const meta: Meta<typeof StartPagePreview> = {
  title: "Start/StartPage",
  component: StartPagePreview,
  parameters: { layout: "padded" },
};

export default meta;

type Story = StoryObj<typeof StartPagePreview>;

export const Default: Story = {};

export const NoRecentResources: Story = {
  render: () => (
    <Stack w="full" maxW="52rem" gap="3xl">
      <StartAboutPanel />
      <Stack direction={{ base: "column", md: "row" }} gap={{ base: "3xl", md: "4xl" }} align="flex-start" minW="0">
        <Box flex="1" minW="0" w="full">
          <StartActionList actions={actions} />
        </Box>
        <Box flex="1" minW="0" w="full">
          <StartRecentList resources={[]} onOpen={() => undefined} />
        </Box>
      </Stack>
    </Stack>
  ),
};
