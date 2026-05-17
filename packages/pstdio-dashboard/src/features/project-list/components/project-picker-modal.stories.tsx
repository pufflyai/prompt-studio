import { Box, Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { ProjectListBanners } from "./project-list-banners";
import { ProjectSearchableList } from "./project-list-rows";

const meta: Meta = {
  title: "ProjectList/ProjectPickerModal",
  parameters: { layout: "centered" },
};

export default meta;

type Story = StoryObj;

const sampleProjects = [
  {
    id: "1",
    name: "Prompt Studio",
    repoPath: "/Users/dev/code/prompt-studio",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "2",
    name: "Internal Tools",
    repoPath: "/Users/dev/code/internal-tools",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "3",
    name: "Side Project",
    repoPath: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
];

const ModalFrame = (props: { children: React.ReactNode }) => (
  <Box width="640px" borderWidth="1px" borderColor="border.muted" borderRadius="md" padding="lg">
    {props.children}
  </Box>
);

export const Populated: Story = {
  render: () => (
    <ModalFrame>
      <Stack gap="md">
        <ProjectSearchableList
          projects={sampleProjects}
          isLoading={false}
          searchTerm=""
          isCreateProjectDisabled={false}
          onSearchTermChange={() => undefined}
          onCreateProject={() => undefined}
          onSelectProject={() => undefined}
        />
      </Stack>
    </ModalFrame>
  ),
};

export const Empty: Story = {
  render: () => (
    <ModalFrame>
      <Stack gap="md">
        <ProjectSearchableList
          projects={[]}
          isLoading={false}
          searchTerm=""
          isCreateProjectDisabled={false}
          onSearchTermChange={() => undefined}
          onCreateProject={() => undefined}
          onSelectProject={() => undefined}
        />
      </Stack>
    </ModalFrame>
  ),
};

export const NoSearchResults: Story = {
  render: () => (
    <ModalFrame>
      <Stack gap="md">
        <ProjectSearchableList
          projects={[]}
          isLoading={false}
          searchTerm="missing"
          isCreateProjectDisabled={false}
          onSearchTermChange={() => undefined}
          onCreateProject={() => undefined}
          onSelectProject={() => undefined}
        />
      </Stack>
    </ModalFrame>
  ),
};

export const NoAgentsBanner: Story = {
  render: () => (
    <ModalFrame>
      <Stack gap="md">
        <ProjectListBanners showNoAgentsBanner showAgentErrorBanner={false} onRetryAgents={() => undefined} />
        <ProjectSearchableList
          projects={[]}
          isLoading={false}
          searchTerm=""
          isCreateProjectDisabled
          onSearchTermChange={() => undefined}
          onCreateProject={() => undefined}
          onSelectProject={() => undefined}
        />
      </Stack>
    </ModalFrame>
  ),
};

export const AgentLoadError: Story = {
  render: () => (
    <ModalFrame>
      <Stack gap="md">
        <ProjectListBanners showNoAgentsBanner={false} showAgentErrorBanner onRetryAgents={() => undefined} />
        <ProjectSearchableList
          projects={sampleProjects}
          isLoading={false}
          searchTerm=""
          isCreateProjectDisabled
          onSearchTermChange={() => undefined}
          onCreateProject={() => undefined}
          onSelectProject={() => undefined}
        />
      </Stack>
    </ModalFrame>
  ),
};
