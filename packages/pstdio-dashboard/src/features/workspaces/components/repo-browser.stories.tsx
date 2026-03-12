import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import type { WorkspacePanelMenuOption } from "./repo-browser";
import { RepoBrowser } from "./repo-browser";

const meta: Meta<typeof RepoBrowser> = {
  title: "Workspaces/RepoBrowser",
  component: RepoBrowser,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <Box maxWidth="400px">
        <Story />
      </Box>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof RepoBrowser>;

const repositoryOptions = [
  { label: "prompt-studio", value: "prompt-studio" },
  { label: "pstdio-api", value: "pstdio-api" },
  { label: "pstdio-docs", value: "pstdio-docs" },
];

const branchesByRepo: Record<string, WorkspacePanelMenuOption[]> = {
  "prompt-studio": [
    { label: "main", value: "main" },
    { label: "feat/chat-sessions", value: "feat/chat-sessions" },
    { label: "fix/workspace-sync", value: "fix/workspace-sync" },
    { label: "workspace/PS-12_A1", value: "workspace/PS-12_A1" },
  ],
  "pstdio-api": [
    { label: "main", value: "main" },
    { label: "feat/streaming", value: "feat/streaming" },
  ],
  "pstdio-docs": [{ label: "main", value: "main" }],
};

export const Default: Story = {
  render: () => {
    const [selectedRepo, setSelectedRepo] = useState("prompt-studio");
    const [selectedBranch, setSelectedBranch] = useState("main");

    const handleSelectRepo = (repo: string) => {
      setSelectedRepo(repo);
      setSelectedBranch("main");
    };

    return (
      <RepoBrowser
        repositoryOptions={repositoryOptions}
        selectedRepository={selectedRepo}
        onSelectRepository={handleSelectRepo}
        branchOptions={branchesByRepo[selectedRepo] ?? []}
        selectedBranch={selectedBranch}
        onSelectBranch={setSelectedBranch}
      />
    );
  },
};

export const SingleRepository: Story = {
  render: () => {
    const [selectedBranch, setSelectedBranch] = useState("main");

    return (
      <RepoBrowser
        repositoryOptions={[repositoryOptions[0]]}
        selectedRepository="prompt-studio"
        onSelectRepository={() => undefined}
        branchOptions={branchesByRepo["prompt-studio"]}
        selectedBranch={selectedBranch}
        onSelectBranch={setSelectedBranch}
      />
    );
  },
};

export const NoBranches: Story = {
  render: () => {
    const [selectedRepo, setSelectedRepo] = useState("prompt-studio");

    return (
      <RepoBrowser
        repositoryOptions={repositoryOptions}
        selectedRepository={selectedRepo}
        onSelectRepository={setSelectedRepo}
        branchOptions={[]}
        selectedBranch=""
        onSelectBranch={() => undefined}
      />
    );
  },
};

export const NoRepositories: Story = {
  args: {
    repositoryOptions: [],
    selectedRepository: "",
    onSelectRepository: () => undefined,
    branchOptions: [],
    selectedBranch: "",
    onSelectBranch: () => undefined,
  },
};

export const Loading: Story = {
  args: {
    repositoryOptions: [],
    selectedRepository: "",
    onSelectRepository: () => undefined,
    branchOptions: [],
    selectedBranch: "",
    onSelectBranch: () => undefined,
    isReposLoading: true,
    isBranchesLoading: true,
  },
};

export const Disabled: Story = {
  args: {
    repositoryOptions,
    selectedRepository: "prompt-studio",
    onSelectRepository: () => undefined,
    branchOptions: branchesByRepo["prompt-studio"],
    selectedBranch: "main",
    onSelectBranch: () => undefined,
    isDisabled: true,
  },
};

export const NoSelection: Story = {
  render: () => {
    const [selectedRepo, setSelectedRepo] = useState("");
    const [selectedBranch, setSelectedBranch] = useState("");

    const handleSelectRepo = (repo: string) => {
      setSelectedRepo(repo);
      setSelectedBranch("main");
    };

    return (
      <RepoBrowser
        repositoryOptions={repositoryOptions}
        selectedRepository={selectedRepo}
        onSelectRepository={handleSelectRepo}
        branchOptions={branchesByRepo[selectedRepo] ?? []}
        selectedBranch={selectedBranch}
        onSelectBranch={setSelectedBranch}
      />
    );
  },
};
