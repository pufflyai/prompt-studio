import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";

import { ProjectRepositoriesPanel } from "./project-repositories-panel";

const meta: Meta<typeof ProjectRepositoriesPanel> = {
  title: "ProjectSettings/ProjectRepositoriesPanel",
  component: ProjectRepositoriesPanel,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <Box maxWidth="640px">
        <Story />
      </Box>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof ProjectRepositoriesPanel>;

export const WithRepositories: Story = {
  args: {
    projectId: "project-1",
    repositories: [
      {
        id: "repo-1",
        name: "prompt-studio",
        displayName: "Prompt Studio",
        path: "/Users/dev/Projects/prompt-studio",
        createdAt: "2026-01-15T10:00:00Z",
        updatedAt: "2026-03-20T14:30:00Z",
      },
      {
        id: "repo-2",
        name: "api-server",
        displayName: null,
        path: "/Users/dev/Projects/api-server",
        createdAt: "2026-02-01T08:00:00Z",
        updatedAt: "2026-03-18T09:15:00Z",
      },
    ],
  },
};

export const SingleRepository: Story = {
  args: {
    projectId: "project-1",
    repositories: [
      {
        id: "repo-1",
        name: "prompt-studio",
        displayName: "Prompt Studio",
        path: "/Users/dev/Projects/prompt-studio",
        createdAt: "2026-01-15T10:00:00Z",
        updatedAt: "2026-03-20T14:30:00Z",
      },
    ],
  },
};

export const Empty: Story = {
  args: {
    projectId: "project-1",
    repositories: [],
  },
};
