import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { Cpu, TerminalIcon } from "lucide-react";
import { useState } from "react";

import type { WorkspacePanelMenuOption } from "./agent-browser";
import { WorkspaceAgentMenu } from "./agent-browser";

const meta: Meta<typeof WorkspaceAgentMenu> = {
  title: "Agents/AgentBrowser",
  component: WorkspaceAgentMenu,
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

type Story = StoryObj<typeof WorkspaceAgentMenu>;

const agentOptions = [
  { label: "Claude Code", value: "claude-code", icon: TerminalIcon },
  { label: "OpenCode", value: "opencode", icon: TerminalIcon },
  { label: "Codex", value: "codex", icon: Cpu },
];

const modelsByAgent: Record<string, WorkspacePanelMenuOption[]> = {
  "claude-code": [
    { label: "Claude Sonnet 4", value: "claude-sonnet-4" },
    { label: "Claude Opus 4", value: "claude-opus-4" },
    { label: "Claude Haiku 4", value: "claude-haiku-4" },
  ],
  opencode: [
    { label: "Claude Sonnet 4", value: "claude-sonnet-4" },
    { label: "GPT-4o", value: "gpt-4o" },
    { label: "Gemini 2.5 Pro", value: "gemini-2.5-pro" },
  ],
  codex: [
    { label: "GPT-4o", value: "gpt-4o" },
    { label: "o3", value: "o3" },
  ],
};

const defaultModelByAgent: Record<string, string> = {
  "claude-code": "claude-sonnet-4",
  opencode: "gpt-4o",
  codex: "o3",
};

export const Default: Story = {
  render: () => {
    const [selectedAgent, setSelectedAgent] = useState("claude-code");
    const [selectedModel, setSelectedModel] = useState("claude-sonnet-4");

    const handleSelectAgent = (agent: string) => {
      setSelectedAgent(agent);
      setSelectedModel(defaultModelByAgent[agent] ?? "");
    };

    return (
      <WorkspaceAgentMenu
        agentOptions={agentOptions}
        selectedAgent={selectedAgent}
        onSelectAgent={handleSelectAgent}
        modelOptions={modelsByAgent[selectedAgent] ?? []}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
      />
    );
  },
};

export const SingleAgent: Story = {
  render: () => {
    const [selectedModel, setSelectedModel] = useState("claude-sonnet-4");

    return (
      <WorkspaceAgentMenu
        agentOptions={[agentOptions[0]]}
        selectedAgent="claude-code"
        onSelectAgent={() => undefined}
        modelOptions={modelsByAgent["claude-code"]}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
      />
    );
  },
};

export const NoModels: Story = {
  render: () => {
    const [selectedAgent, setSelectedAgent] = useState("claude-code");

    return (
      <WorkspaceAgentMenu
        agentOptions={agentOptions}
        selectedAgent={selectedAgent}
        onSelectAgent={setSelectedAgent}
        modelOptions={[]}
        selectedModel=""
        onSelectModel={() => undefined}
      />
    );
  },
};

export const Disabled: Story = {
  args: {
    agentOptions,
    selectedAgent: "claude-code",
    onSelectAgent: () => undefined,
    modelOptions: modelsByAgent["claude-code"],
    selectedModel: "claude-sonnet-4",
    onSelectModel: () => undefined,
    isDisabled: true,
  },
};

export const DisabledAgentSwitch: Story = {
  render: () => {
    const [selectedModel, setSelectedModel] = useState("claude-sonnet-4");

    return (
      <WorkspaceAgentMenu
        agentOptions={agentOptions}
        selectedAgent="claude-code"
        onSelectAgent={() => undefined}
        modelOptions={modelsByAgent["claude-code"]}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        isAgentSwitchDisabled
      />
    );
  },
};

export const WithDisabledAgent: Story = {
  render: () => {
    const [selectedAgent, setSelectedAgent] = useState("claude-code");
    const [selectedModel, setSelectedModel] = useState("claude-sonnet-4");

    const allAgents = [
      ...agentOptions,
      { label: "Unavailable Agent", value: "unavailable", icon: Cpu, disabled: true },
    ];

    const handleSelectAgent = (agent: string) => {
      setSelectedAgent(agent);
      setSelectedModel(defaultModelByAgent[agent] ?? "");
    };

    return (
      <WorkspaceAgentMenu
        agentOptions={allAgents}
        selectedAgent={selectedAgent}
        onSelectAgent={handleSelectAgent}
        modelOptions={modelsByAgent[selectedAgent] ?? []}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
      />
    );
  },
};

export const NoSelection: Story = {
  render: () => {
    const [selectedAgent, setSelectedAgent] = useState("");
    const [selectedModel, setSelectedModel] = useState("");

    const handleSelectAgent = (agent: string) => {
      setSelectedAgent(agent);
      setSelectedModel(defaultModelByAgent[agent] ?? "");
    };

    return (
      <WorkspaceAgentMenu
        agentOptions={agentOptions}
        selectedAgent={selectedAgent}
        onSelectAgent={handleSelectAgent}
        modelOptions={modelsByAgent[selectedAgent] ?? []}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
      />
    );
  },
};
