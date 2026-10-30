import { Box, Button, Dialog, Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { Cpu, TerminalIcon } from "lucide-react";
import { useState } from "react";
import { WorkspaceAgentMenu, type WorkspacePanelMenuOption } from "./workspace-agent-menu";

const meta: CanvasMeta<typeof WorkspaceAgentMenu> = {
  title: "Shared/WorkspaceAgentMenu",
  component: WorkspaceAgentMenu,
  decorators: [
    (Story) => (
      <Box maxWidth="400px">
        <Story />
      </Box>
    ),
  ],
};
export default meta;
type Story = CanvasFrame<typeof WorkspaceAgentMenu>;
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
  id: "shared-workspaceagentmenu--default",
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
  id: "shared-workspaceagentmenu--single-agent",
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
  id: "shared-workspaceagentmenu--no-models",
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
// A harness without models, such as a remote machine whose template picks the model.
export const WithoutModelChoice: Story = {
  id: "shared-workspaceagentmenu--without-model-choice",
  render: () => {
    const [selectedAgent, setSelectedAgent] = useState("claude-code");
    return (
      <WorkspaceAgentMenu
        agentOptions={[...agentOptions, { label: "Outdated Agent", value: "unavailable", icon: Cpu, disabled: true }]}
        selectedAgent={selectedAgent}
        onSelectAgent={setSelectedAgent}
        modelOptions={[]}
        selectedModel=""
        onSelectModel={() => undefined}
        offersModels={false}
      />
    );
  },
};
// A session's harness is fixed and offers no models, so there is nothing to choose.
export const WithoutModelChoiceLockedAgent: Story = {
  id: "shared-workspaceagentmenu--without-model-choice-locked-agent",
  args: {
    agentOptions,
    selectedAgent: "claude-code",
    onSelectAgent: () => undefined,
    modelOptions: [],
    selectedModel: "",
    onSelectModel: () => undefined,
    offersModels: false,
    isAgentSwitchDisabled: true,
  },
};
export const Disabled: Story = {
  id: "shared-workspaceagentmenu--disabled",
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
  id: "shared-workspaceagentmenu--disabled-agent-switch",
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
const unavailableReason = "Requires Codex 0.157.0 or newer. Found 0.155.0.";
export const WithDisabledAgent: Story = {
  id: "shared-workspaceagentmenu--with-disabled-agent",
  render: () => {
    const [selectedAgent, setSelectedAgent] = useState("claude-code");
    const [selectedModel, setSelectedModel] = useState("claude-sonnet-4");
    const allAgents = [
      ...agentOptions,
      {
        label: "Outdated Agent",
        value: "unavailable",
        icon: Cpu,
        disabled: true,
        description: unavailableReason,
      },
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
  id: "shared-workspaceagentmenu--loading",
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
  id: "shared-workspaceagentmenu--no-selection",
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
  id: "shared-workspaceagentmenu--no-harness-available",
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
  id: "shared-workspaceagentmenu--command-dialog-placement",
  fullscreen: true,
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
};
