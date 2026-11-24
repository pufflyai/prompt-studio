import { Button, Dialog, Input, Stack, Text } from "@chakra-ui/react";
import { useScopedQuery } from "@pstdio/sdk/extensions/react";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { useState, useSyncExternalStore } from "react";
import { getDashboardAccountStatusQuery } from "@/lib/scoped-queries";
import { getRuntimeCollections } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { FolderPicker } from "@/shared/filesystem/folder-picker";
import { getProjectCreation, projectCreationPresentation } from "../data/project-creation";

interface CreateProjectWidgetProps {
  input: WorkbenchPanelRenderInput;
  onProjectOpening?: (project: Promise<{ id: string; created?: boolean }>) => Promise<void>;
}
export const CreateProjectWidget = (props: CreateProjectWidgetProps) => {
  const { input, onProjectOpening } = props;
  const selectedTeam = input.instance.pageContext?.params?.teamAccountId;
  const teamAccountId = typeof selectedTeam === "string" ? selectedTeam : undefined;
  const status = useScopedQuery(getDashboardAccountStatusQuery(getRuntimeCollections())).data;
  const team = status?.teamAccounts?.find(({ accountId }) => accountId === teamAccountId);
  const creation = getProjectCreation();
  const snapshot = useSyncExternalStore(creation.subscribe, creation.read, creation.read);
  const presentation = projectCreationPresentation(snapshot, teamAccountId);
  const [teamNameInput, setTeamName] = useState<string>();
  const teamName = teamNameInput ?? presentation.name ?? "";
  const [choosingFolder, setChoosingFolder] = useState(false);
  const [openError, setOpenError] = useState<string>();
  const canCreateTeamProject = team?.role === "owner" && team.features.relay && Boolean(teamName.trim());
  const openProject = async (path: string) => {
    setOpenError(undefined);
    const initialProjectId = getDashboardSelectedProjectId(input.workbench);
    const creating = creation.open(path, teamAccountId ? { teamAccountId, name: teamName.trim() } : undefined);
    // Track the expected project before creation; setup waits for enabled contributions.
    const setup = onProjectOpening?.(creating);
    try {
      const project = await creating;
      if (getDashboardSelectedProjectId(input.workbench) !== initialProjectId) return;
      await input.workbench.commands.executeCommand(dashboardCommandIds.selectProject, {
        project: { id: project.id, name: project.name },
      });
      input.workbench.layout.removeWidgetPlacement(input.instance.instanceId);
      await setup;
    } catch (error) {
      setOpenError(error instanceof Error ? error.message : undefined);
    }
  };
  if (teamAccountId && (!canCreateTeamProject || (!choosingFolder && !presentation.path)))
    return (
      <>
        <Dialog.Header>
          <Dialog.Title>Create team project</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <Stack gap="sm">
            {team ? <Text>Account {team.name}</Text> : <Text>This team is unavailable.</Text>}
            <Input
              aria-label="Project name"
              placeholder="Project name"
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
            />
          </Stack>
        </Dialog.Body>
        <Dialog.Footer>
          <Button
            variant="outline"
            onClick={() => input.workbench.layout.removeWidgetPlacement(input.instance.instanceId)}
          >
            Cancel
          </Button>
          <Button variant="primary" disabled={!canCreateTeamProject} onClick={() => setChoosingFolder(true)}>
            Choose folder
          </Button>
        </Dialog.Footer>
      </>
    );
  return (
    <FolderPicker
      isOpening={presentation.isOpening}
      error={presentation.error ?? openError}
      initialPath={presentation.path}
      onSelect={openProject}
      onClose={() => input.workbench.layout.removeWidgetPlacement(input.instance.instanceId)}
    />
  );
};
