import { Box, Button, Dialog, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { Cpu, TerminalIcon } from "lucide-react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { WorkspaceAgentMenu, type WorkspacePanelMenuOption } from "./workspace-agent-menu";

const meta: Meta<typeof WorkspaceAgentMenu> = {
  title: "Shared/WorkspaceAgentMenu",
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
    { label: "Claude Sonnet 4", value: "claude-sonnet-4", description: "Balanced speed and intelligence" },
    { label: "Claude Opus 4", value: "claude-opus-4" },
    { label: "Claude Haiku 4", value: "claude-haiku-4" },
  ],
  opencode: [
    { label: "openai/gpt-5.5", value: "openai/gpt-5.5" },
    { label: "opencode/gpt-5.5", value: "opencode/gpt-5.5" },
    { label: "google/gemini-2.5-pro", value: "google/gemini-2.5-pro" },
  ],
  codex: [
    { label: "GPT-4o", value: "gpt-4o" },
    { label: "o3", value: "o3" },
  ],
};

const defaultModelByAgent: Record<string, string> = {
  "claude-code": "claude-sonnet-4",
  opencode: "openai/gpt-5.5",
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

export const Loading: Story = {
  args: {
    agentOptions: [],
    selectedAgent: "",
    onSelectAgent: () => undefined,
    modelOptions: [],
    selectedModel: "",
    onSelectModel: () => undefined,
    isAgentsLoading: true,
    isModelsLoading: true,
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

export const NoHarnessAvailable: Story = {
  args: {
    agentOptions: [],
    selectedAgent: "",
    onSelectAgent: () => {},
    modelOptions: [],
    selectedModel: "",
    onSelectModel: () => {},
  },
};

export const CommandDialogPlacement: Story = {
  tags: ["!manifest"],
  parameters: { layout: "fullscreen" },
  render: () => {
    const [selectedAgent, setSelectedAgent] = useState("claude-code");
    const [selectedModel, setSelectedModel] = useState("claude-sonnet-4");

    const handleSelectAgent = (agent: string) => {
      setSelectedAgent(agent);
      setSelectedModel(defaultModelByAgent[agent] ?? "");
    };

    return (
      <Dialog.Root open size="lg" scrollBehavior="inside">
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content display="flex" flexDirection="column" maxH="calc(100% - 48px)">
            <Dialog.Header>
              <Dialog.Title>Run review</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body flex="1" minH="0">
              <Box h="3.5rem" overflow="hidden">
                <Stack gap="2xs">
                  <Text textStyle="label/S/medium">Harness</Text>
                  <WorkspaceAgentMenu
                    agentOptions={agentOptions}
                    selectedAgent={selectedAgent}
                    onSelectAgent={handleSelectAgent}
                    modelOptions={modelsByAgent[selectedAgent] ?? []}
                    selectedModel={selectedModel}
                    onSelectModel={setSelectedModel}
                    shouldDisableSingleAgentSwitch={false}
                  />
                </Stack>
              </Box>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="ghost" size="sm">
                Cancel
              </Button>
              <Button variant="primary" size="sm">
                Run
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: "Select model" }));

    await within(document.body).findByTestId("workspace-agent-model-options");
    const menuItem = within(document.body).getByRole("menuitem", { name: "Claude Opus 4" });
    await expect(within(document.body).queryByRole("option", { name: "Claude Opus 4" })).not.toBeInTheDocument();

    const box = menuItem.getBoundingClientRect();
    const hitTarget = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);

    await expect(menuItem.contains(hitTarget) || hitTarget?.contains(menuItem)).toBe(true);
  },
};
