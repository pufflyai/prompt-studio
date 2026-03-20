import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { Session } from "../types";
import { SessionsList } from "./sessions-list";

const now = new Date();
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

const mockSessions: Session[] = [
  {
    id: "s1",
    projectId: "p1",
    agentSessionId: null,
    title: "Fix authentication redirect loop",
    status: "completed",
    archived: false,
    agent: "claude-code",
    createdAt: hoursAgo(1),
    updatedAt: hoursAgo(1),
  },
  {
    id: "s2",
    projectId: "p1",
    agentSessionId: null,
    title: "Add dark mode support",
    status: "in_progress",
    archived: false,
    agent: "claude-code",
    createdAt: hoursAgo(3),
    updatedAt: hoursAgo(2),
  },
  {
    id: "s3",
    projectId: "p1",
    agentSessionId: null,
    title: "Refactor database queries",
    status: "failed",
    archived: false,
    agent: "claude-code",
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
  },
  {
    id: "s4",
    projectId: "p1",
    agentSessionId: null,
    title: "Implement user settings page",
    status: "completed",
    archived: false,
    agent: "claude-code",
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
  },
  {
    id: "s5",
    projectId: "p1",
    agentSessionId: null,
    title: "Set up CI pipeline",
    status: "completed",
    archived: false,
    agent: "claude-code",
    createdAt: daysAgo(3),
    updatedAt: daysAgo(3),
  },
];

const meta: Meta<typeof SessionsList> = {
  title: "Sessions/SessionsList",
  component: SessionsList,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <Box maxWidth="18rem" borderWidth="1px" borderRadius="md">
        <Story />
      </Box>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof SessionsList>;

export const Default: Story = {
  args: {
    sessions: mockSessions,
    selectedSessionId: null,
    isLoading: false,
    onSelectSession: () => {},
  },
};

export const WithSelection: Story = {
  args: {
    sessions: mockSessions,
    selectedSessionId: "s2",
    isLoading: false,
    onSelectSession: () => {},
  },
};

export const Loading: Story = {
  args: {
    sessions: [],
    selectedSessionId: null,
    isLoading: true,
    onSelectSession: () => {},
  },
};

export const Empty: Story = {
  args: {
    sessions: [],
    selectedSessionId: null,
    isLoading: false,
    onSelectSession: () => {},
  },
};
