import { Button, Dialog, Stack, Text } from "@chakra-ui/react";
import { toaster } from "@pstdio/ui";
import type { WorkbenchWidgetRenderInput } from "@pstdio/workbench/react";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AgentInfo } from "@/shared/agents/agent-types";
import { useAgents } from "@/shared/agents/use-agents";
import { createProject } from "../data/project-creation";
import {
  canSubmitAgentSelection,
  type DraftRepository,
  hasProjectBasicsErrors,
  resolveInitialSelectedAgentIds,
  resolveProjectCreationAvailability,
  resolveRepoName,
  toggleAgentSelection,
} from "./create-project-state";
import { AgentsStep, ProjectBasicsStep } from "./create-project-steps";
import { RepoPickerDialog } from "./repo-picker-dialog";

const emptyAgentInfo: AgentInfo[] = [];

const isPlacementOpen = (input: WorkbenchWidgetRenderInput) =>
  Object.values(input.workbench.layout.getLayout().areas).some((area) =>
    area.widgets.some((placement) => placement.widgetId === input.placement.widgetId),
  );

const closeCurrentPlacement = (input: WorkbenchWidgetRenderInput) => {
  if (input.placement.closable === true && isPlacementOpen(input)) {
    input.workbench.layout.closeWidget(input.placement.widgetId);
  }
};

export const CreateProjectWidget = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  const { t } = useTranslation(["projects", "common"]);
  const agentsQuery = useAgents();
  const createProjectMutation = useMutation({ mutationFn: createProject });
  const [name, setName] = useState("");
  const [repositories, setRepositories] = useState<DraftRepository[]>([]);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [step, setStep] = useState<1 | 2>(1);
  const [isRepoPickerOpen, setRepoPickerOpen] = useState(false);
  const [repoError, setRepoError] = useState("");
  const [touched, setTouched] = useState(false);
  const [agentsTouched, setAgentsTouched] = useState(false);
  const agentInfo = agentsQuery.data ?? emptyAgentInfo;
  const availability = resolveProjectCreationAvailability({
    agentInfo,
    isAgentsLoading: agentsQuery.isLoading,
    isAgentsError: agentsQuery.isError,
  });
  const isWorking = createProjectMutation.isPending;
  const hasAvailableAgents = availability.availableAgents.length > 0;

  useEffect(() => {
    const nextAvailability = resolveProjectCreationAvailability({
      agentInfo,
      isAgentsLoading: agentsQuery.isLoading,
      isAgentsError: agentsQuery.isError,
    });
    setSelectedAgentIds(resolveInitialSelectedAgentIds(nextAvailability.availableAgents));
  }, [agentInfo, agentsQuery.isError, agentsQuery.isLoading]);

  const handleNext = () => {
    setTouched(true);
    if (hasProjectBasicsErrors({ name, repositories })) return;
    setStep(2);
  };

  const handleSubmit = async () => {
    setAgentsTouched(true);
    if (hasAvailableAgents && !canSubmitAgentSelection(selectedAgentIds)) return;

    try {
      const project = await createProjectMutation.mutateAsync({
        name: name.trim(),
        repositories: repositories.map((repo) => ({ path: repo.path, displayName: repo.displayName })),
        agents: selectedAgentIds,
      });
      toaster.create({ type: "success", title: t("projects:list.projectCreated"), description: project.name });
      await input.workbench.resources.openResource(project.resource, { replaceActive: true });
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "Unable to create project.";
      toaster.create({ type: "error", title: t("projects:list.createProjectFailed"), description: message });
    }
  };

  const handleRepoSelected = (path: string | null) => {
    if (!path) {
      setRepoPickerOpen(false);
      return;
    }

    const trimmedPath = path.trim();
    if (!trimmedPath) {
      setRepoError(t("projects:createProjectDialog.repositories.errors.pathRequired"));
      return;
    }

    if (repositories.some((repo) => repo.path === trimmedPath)) {
      setRepoError(t("projects:createProjectDialog.repositories.errors.alreadyAdded"));
      return;
    }

    setRepositories((current) => [
      ...current,
      { path: trimmedPath, name: resolveRepoName(trimmedPath), displayName: null },
    ]);
    setRepoError("");
    setRepoPickerOpen(false);
  };

  const handleRemoveRepo = (path: string) => {
    setRepositories((current) => current.filter((repo) => repo.path !== path));
  };

  return (
    <>
      <Dialog.Header py="xs" px="sm">
        <Text textStyle="label/S/medium">{t("projects:createProjectDialog.title")}</Text>
      </Dialog.Header>
      <Dialog.Body px="sm" py="sm">
        {step === 1 ? (
          <ProjectBasicsStep
            name={name}
            repositories={repositories}
            touched={touched}
            repoError={repoError}
            isWorking={isWorking}
            onNameChange={setName}
            onBrowseRepositories={() => {
              setRepoError("");
              setRepoPickerOpen(true);
            }}
            onRemoveRepository={handleRemoveRepo}
          />
        ) : (
          <AgentsStep
            availableAgents={availability.availableAgents}
            selectedAgentIds={selectedAgentIds}
            hasAgentError={agentsTouched && hasAvailableAgents && selectedAgentIds.length === 0}
            isWorking={isWorking}
            isAgentsLoading={agentsQuery.isLoading}
            showNoAgents={availability.hasNoAgents}
            showAgentError={availability.showAgentErrorBanner}
            onAgentToggle={(agentId) => setSelectedAgentIds((current) => toggleAgentSelection(current, agentId))}
          />
        )}
      </Dialog.Body>
      <Dialog.Footer px="sm" py="sm">
        <Stack direction="row" gap="1">
          {step === 1 ? (
            <>
              <Button onClick={() => closeCurrentPlacement(input)} variant="outline">
                {t("common:buttons.cancel")}
              </Button>
              <Button onClick={handleNext} variant="primary">
                {t("projects:createProjectDialog.actions.next")}
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => setStep(1)} variant="outline" disabled={isWorking}>
                {t("projects:createProjectDialog.actions.back")}
              </Button>
              <Button
                onClick={handleSubmit}
                loading={isWorking}
                variant="primary"
                disabled={availability.isCreateProjectBlocked}
              >
                {t("projects:createProjectDialog.actions.create")}
              </Button>
            </>
          )}
        </Stack>
      </Dialog.Footer>
      <RepoPickerDialog
        open={isRepoPickerOpen}
        title={t("projects:createProjectDialog.folderPicker.title")}
        description={t("projects:createProjectDialog.folderPicker.description")}
        onClose={() => setRepoPickerOpen(false)}
        onSelect={handleRepoSelected}
        selectedPaths={repositories.map((repo) => repo.path)}
      />
    </>
  );
};
