import { Box, Button, Flex, Icon, Menu, Text } from "@chakra-ui/react";
import { ListRow, SearchableMenu, Tooltip } from "@pstdio/ui";
import { ChevronDown, Cpu, FolderGit2, GitBranch, TerminalIcon } from "lucide-react";
import { useState } from "react";

const agentOptions = [
  { id: "opencode", label: "OpenCode", icon: TerminalIcon },
  { id: "claude-code", label: "Claude Code", icon: TerminalIcon },
];

const modelOptions = [
  { id: "gpt-5.2", label: "gpt-5.2", icon: Cpu },
  { id: "gpt-5.4", label: "gpt-5.4", icon: Cpu },
  { id: "claude-sonnet-4.5", label: "claude-sonnet-4.5", icon: Cpu },
];

const repositoryOptions = [
  { id: "prompt-studio", label: "prompt-studio", icon: FolderGit2 },
  { id: "pstdio-dashboard-wb", label: "pstdio-dashboard-wb", icon: FolderGit2 },
];

const branchOptions = [
  { id: "main", label: "main (current)", icon: GitBranch },
  { id: "feature/dashboard-workbench", label: "feature/dashboard-workbench", icon: GitBranch },
];

const emptyModelState = (
  <Menu.Item value="empty" asChild>
    <ListRow
      asChild
      variant="compact"
      id="empty"
      label="No models available"
      icon={<Icon as={Cpu} boxSize="16px" />}
      disabled
    />
  </Menu.Item>
);

const emptyBranchState = (
  <Menu.Item value="empty" asChild>
    <ListRow
      asChild
      variant="compact"
      id="empty"
      label="No branches available"
      icon={<Icon as={GitBranch} boxSize="16px" />}
      disabled
    />
  </Menu.Item>
);

export const SessionAgentBrowser = () => {
  const [selectedAgent, setSelectedAgent] = useState(agentOptions[0]?.id ?? "");
  const [selectedModel, setSelectedModel] = useState(modelOptions[0]?.id ?? "");
  const selectedAgentLabel = agentOptions.find((agent) => agent.id === selectedAgent)?.label ?? "Select agent";
  const selectedModelLabel = modelOptions.find((model) => model.id === selectedModel)?.label ?? "Select model";

  return (
    <SearchableMenu
      trigger={
        <Box>
          <Tooltip content="Select model">
            <Button variant="ghost" size="sm" px="2" aria-label="Select model">
              <Text textStyle="label/XS/medium" color="fg">
                {selectedModelLabel}
              </Text>
              <ChevronDown size={14} />
            </Button>
          </Tooltip>
        </Box>
      }
      items={modelOptions.map((model) => ({
        ...model,
        isSelected: model.id === selectedModel,
        onSelect: () => setSelectedModel(model.id),
      }))}
      showSearch={false}
      width="260px"
      portalled={false}
      searchPlaceholder="Search models"
      contentTestId="dashboard-workbench-agent-model-options"
      emptyState={emptyModelState}
      parentList={{
        items: agentOptions.map((agent) => ({ ...agent, isSelected: agent.id === selectedAgent })),
        selectedLabel: selectedAgentLabel,
        selectedIcon: TerminalIcon,
        ariaLabel: "Select agent",
        disabled: agentOptions.length <= 1,
        showSearch: false,
        contentTestId: "dashboard-workbench-agent-options",
        onSelect: (item) => {
          setSelectedAgent(item.id);
          setSelectedModel(modelOptions[0]?.id ?? "");
        },
      }}
    />
  );
};

export const SessionRepoBrowser = () => {
  const [selectedRepository, setSelectedRepository] = useState(repositoryOptions[0]?.id ?? "");
  const [selectedBranch, setSelectedBranch] = useState(branchOptions[0]?.id ?? "");
  const selectedRepositoryLabel =
    repositoryOptions.find((repository) => repository.id === selectedRepository)?.label ?? "Select repository";
  const selectedBranchLabel = branchOptions.find((branch) => branch.id === selectedBranch)?.label ?? "Select branch";

  return (
    <SearchableMenu
      trigger={
        <Box>
          <Tooltip content="Select branch">
            <Button variant="ghost" size="sm" px="2" aria-label="Select branch">
              <GitBranch size={14} />
              <Text textStyle="label/XS/medium" color="fg" ml="2xs">
                {selectedBranchLabel}
              </Text>
              <ChevronDown size={14} />
            </Button>
          </Tooltip>
        </Box>
      }
      items={branchOptions.map((branch) => ({
        ...branch,
        isSelected: branch.id === selectedBranch,
        onSelect: () => setSelectedBranch(branch.id),
      }))}
      showSearch={false}
      width="260px"
      searchPlaceholder="Search branches"
      contentTestId="dashboard-workbench-repo-branch-options"
      emptyState={emptyBranchState}
      parentList={{
        items: repositoryOptions.map((repository) => ({
          ...repository,
          isSelected: repository.id === selectedRepository,
        })),
        selectedLabel: selectedRepositoryLabel,
        selectedIcon: FolderGit2,
        ariaLabel: "Select repository",
        disabled: repositoryOptions.length <= 1,
        showSearch: false,
        contentTestId: "dashboard-workbench-repo-options",
        onSelect: (item) => {
          setSelectedRepository(item.id);
          setSelectedBranch(branchOptions[0]?.id ?? "");
        },
      }}
    />
  );
};

export const SessionRuntimeControls = () => (
  <Flex justifyContent="space-between" align="center" gap="2xs" w="full" minW="0" px="xs" pb="xs" wrap="nowrap">
    <Box flexShrink="0">
      <SessionAgentBrowser />
    </Box>
    <SessionRepoBrowser />
  </Flex>
);
