import { Button, Icon as ChakraIcon, IconButton, Input, Stack, Text } from "@chakra-ui/react";
import { ListRow } from "@pstdio/ui";
import { FolderOpen, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DraftRepository } from "./create-project-state";

interface ProjectBasicsStepProps {
  name: string;
  repositories: DraftRepository[];
  touched: boolean;
  repoError: string;
  isWorking: boolean;
  onNameChange: (value: string) => void;
  onBrowseRepositories: () => void;
  onRemoveRepository: (path: string) => void;
}

interface AgentsStepProps {
  availableAgents: { id: string; name: string }[];
  selectedAgentIds: string[];
  hasAgentError: boolean;
  isWorking: boolean;
  isAgentsLoading: boolean;
  showNoAgents: boolean;
  showAgentError: boolean;
  onAgentToggle: (agentId: string) => void;
}

export const ProjectBasicsStep = (props: ProjectBasicsStepProps) => {
  const { name, repositories, touched, repoError, isWorking, onNameChange, onBrowseRepositories, onRemoveRepository } =
    props;
  const { t } = useTranslation("projects");
  const trimmedName = name.trim();
  const hasNameError = touched && trimmedName.length === 0;
  const hasRepoError = touched && repositories.length === 0;

  return (
    <Stack gap="md">
      <Stack gap="xs">
        <Text textStyle="label/XS/regular" color="fg.muted">
          {t("createProjectDialog.projectName.label")}
        </Text>
        <Input
          placeholder={t("createProjectDialog.projectName.placeholder")}
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          disabled={isWorking}
          autoFocus
        />
        {hasNameError ? (
          <Text textStyle="label/XS/regular" color="red.500">
            {t("createProjectDialog.projectName.required")}
          </Text>
        ) : null}
      </Stack>

      <Stack gap="xs">
        <Text textStyle="label/XS/regular" color="fg.muted">
          {t("createProjectDialog.repositories.label")}
        </Text>
        {repositories.length === 0 ? (
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            {t("createProjectDialog.repositories.empty")}
          </Text>
        ) : (
          <Stack gap="xs">
            {repositories.map((repo) => (
              <Stack key={repo.path} direction="row" gap="sm" align="center">
                <Stack flex="1">
                  <ListRow
                    variant="compact"
                    id={repo.path}
                    label={repo.displayName ?? repo.name}
                    description={repo.path}
                    icon={<ChakraIcon as={FolderOpen} boxSize="16px" />}
                    disabled
                  />
                </Stack>
                <IconButton
                  aria-label={t("createProjectDialog.repositories.remove")}
                  size="xs"
                  variant="ghost"
                  onClick={() => onRemoveRepository(repo.path)}
                  disabled={isWorking}
                >
                  <ChakraIcon as={X} boxSize="16px" />
                </IconButton>
              </Stack>
            ))}
          </Stack>
        )}
        <Button size="xs" variant="outline" onClick={onBrowseRepositories} disabled={isWorking}>
          {t("createProjectDialog.repositories.browse")}
        </Button>
        {repoError ? (
          <Text textStyle="label/XS/regular" color="red.500">
            {repoError}
          </Text>
        ) : null}
        {hasRepoError ? (
          <Text textStyle="label/XS/regular" color="red.500">
            {t("createProjectDialog.repositories.selectOne")}
          </Text>
        ) : null}
      </Stack>
    </Stack>
  );
};

export const AgentsStep = (props: AgentsStepProps) => {
  const {
    availableAgents,
    selectedAgentIds,
    hasAgentError,
    isWorking,
    isAgentsLoading,
    showNoAgents,
    showAgentError,
    onAgentToggle,
  } = props;
  const { t } = useTranslation("projects");

  return (
    <Stack gap="sm">
      <Stack gap="2xs">
        <Text textStyle="label/L/medium">{t("createProjectDialog.agents.title")}</Text>
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          {t("createProjectDialog.agents.description")}
        </Text>
      </Stack>
      {isAgentsLoading ? (
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          {t("chatInput.agent.loading")}
        </Text>
      ) : null}
      {showNoAgents ? (
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          {t("createProjectDialog.agents.noAgentsHint")}
        </Text>
      ) : null}
      {showAgentError ? (
        <Text textStyle="paragraph/S/regular" color="red.600">
          {t("list.agentLoadErrorBanner.description")}
        </Text>
      ) : null}
      <Stack gap="xs">
        {availableAgents.map((agent) => {
          const checked = selectedAgentIds.includes(agent.id);

          return (
            <Stack
              as="label"
              key={agent.id}
              direction="row"
              gap="sm"
              align="center"
              borderWidth="1px"
              borderColor={checked ? "border.accent" : "border.muted"}
              px="sm"
              py="sm"
              cursor="pointer"
            >
              <input type="checkbox" checked={checked} onChange={() => onAgentToggle(agent.id)} disabled={isWorking} />
              <Stack gap="0" flex="1">
                <Text textStyle="label/M/medium">{agent.name}</Text>
                <Text textStyle="paragraph/XS/regular" color="fg.muted">
                  {agent.id}
                </Text>
              </Stack>
            </Stack>
          );
        })}
      </Stack>
      {hasAgentError ? (
        <Text textStyle="label/XS/regular" color="red.500">
          {t("createProjectDialog.agents.selectAtLeastOne")}
        </Text>
      ) : null}
    </Stack>
  );
};
