import { Button, Dialog, Stack, Text } from "@chakra-ui/react";
import { toaster } from "@pstdio/ui";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AgentInfo } from "@/shared/agents/agent-types";
import { useAgents } from "@/shared/agents/use-agents";
import { dashboardCommandIds } from "@/shared/app/commands";
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
import { HarnessesStep, ProjectBasicsStep } from "./create-project-steps";
import { RepoPickerDialog } from "./repo-picker-dialog";

const emptyAgentInfo: AgentInfo[] = [];

const isPlacementOpen = (input: WorkbenchPanelRenderInput) =>
  Object.values(input.workbench.layout.getLayout().regions).some((region) =>
    region.widgets.some((placement) => placement.widgetId === input.instance.instanceId),
  );

const closeCurrentPlacement = (input: WorkbenchPanelRenderInput) => {
  if (input.instance.closable === true && isPlacementOpen(input)) {
    input.workbench.layout.closePanel(input.instance.instanceId);
  }
};

export const CreateProjectWidget = (props: { input: WorkbenchPanelRenderInput }) => {
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

  useEffect(() => {
    const nextAvailability = resolveProjectCreationAvailability({
      agentInfo,
      isAgentsLoading: agentsQuery.isLoading,
      isAgentsError: agentsQuery.isError,
    });
    setSelectedAgentIds(resolveInitialSelectedAgentIds(nextAvailability.detectedHarnesses));
  }, [agentInfo, agentsQuery.isError, agentsQuery.isLoading]);

  const handleSubmit = async () => {
    setAgentsTouched(true);
    if (availability.shouldSelectHarness && !canSubmitAgentSelection(selectedAgentIds)) return;

    try {
      const project = await createProjectMutation.mutateAsync({
        name: name.trim(),
        repositories: repositories.map((repo) => ({ path: repo.path, displayName: repo.displayName })),
        agents: selectedAgentIds,
      });
      toaster.create({ type: "success", title: t("projects:list.projectCreated"), description: project.name });
      await input.workbench.commands.executeCommand(dashboardCommandIds.selectProject, {
        project: { id: project.id, name: project.name },
      });
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "Unable to create project.";
      toaster.create({ type: "error", title: t("projects:list.createProjectFailed"), description: message });
    }
  };

  const handleNext = () => {
    setTouched(true);
    if (hasProjectBasicsErrors({ name, repositories })) return;
    if (availability.shouldSelectHarness) {
      setStep(2);
      return;
    }
    void handleSubmit();
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
          <HarnessesStep
            harnesses={availability.harnesses}
            selectedAgentIds={selectedAgentIds}
            hasAgentError={agentsTouched && availability.shouldSelectHarness && selectedAgentIds.length === 0}
            isWorking={isWorking}
            isAgentsLoading={agentsQuery.isLoading}
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
              <Button onClick={handleNext} variant="primary" disabled={agentsQuery.isLoading} loading={isWorking}>
                {agentsQuery.isLoading || availability.shouldSelectHarness
                  ? t("projects:createProjectDialog.actions.next")
                  : t("projects:createProjectDialog.actions.create")}
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => setStep(1)} variant="outline" disabled={isWorking}>
                {t("projects:createProjectDialog.actions.back")}
              </Button>
              <Button onClick={handleSubmit} loading={isWorking} variant="primary">
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
