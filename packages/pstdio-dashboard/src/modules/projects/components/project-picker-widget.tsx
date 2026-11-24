import { Box, Button, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { EmptyState, ListRow, SearchModalContent } from "@pstdio/ui";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { useWorkbenchStore, WORKBENCH_SETTINGS_OPEN_COMMAND_ID } from "@pstdio/workbench/react";
import { Cloud, Folder, Plus, Search, Settings } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCollectionSelection } from "@/lib/sync/use-collection-selection";
import { dashboardCommandIds } from "@/shared/app/commands";
import { dashboardSelectedProjectIdContextKey } from "@/shared/app/project-context";
import { useProjectNameOperations } from "@/shared/projects/project-name-operations";
import { type ProjectCloudState, useCloudProjectStates } from "../data/cloud-project-states";
import { useLocalProjectDeletion } from "../data/local-project-deletion";
import { useCloudProjectCatalog } from "../data/project-catalog";
import { createDashboardProjects, type DashboardProject, mergeCloudProjectCatalog } from "../data/project-data";
import { projectLocationKey } from "../data/project-location";

const filterProjects = (projects: DashboardProject[], searchTerm: string, _dataVersion: unknown) => {
  const query = searchTerm.trim().toLowerCase();
  if (!query) return projects;

  return projects.filter((project) => {
    const folderPath = project.folderPath ?? "";
    return project.name.toLowerCase().includes(query) || folderPath.toLowerCase().includes(query);
  });
};

export interface ProjectPickerRowsProps {
  projects: DashboardProject[];
  selectedProjectId: string | undefined;
  searchTerm: string;
  cloudState: (projectId: string) => ProjectCloudState;
  onSelectProject: (project: DashboardProject) => void;
}

export const ProjectPickerRows = (props: ProjectPickerRowsProps) => {
  const { projects, selectedProjectId, searchTerm, cloudState, onSelectProject } = props;
  const { t } = useTranslation("projects");

  if (projects.length === 0 && searchTerm.trim().length > 0) {
    return (
      <Box px="sm" py="sm">
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          {t("list.noSearchResults")}
        </Text>
      </Box>
    );
  }

  if (projects.length === 0) {
    return (
      <Box px="sm" py="md">
        <EmptyState title={t("list.noProjectsYet")} description={t("list.noProjectsDescription")} />
      </Box>
    );
  }

  return (
    <Stack gap="0">
      {projects.map((project) => {
        const state = cloudState(project.id);
        const location = projectLocationKey(project.folderPath, state);
        return (
          <ListRow
            key={project.id}
            variant="full-width"
            id={project.id}
            label={project.name}
            description={location.key === "path" ? location.path : t(location.key, { path: location.path })}
            icon={<Icon as={state.cloud ? Cloud : Folder} boxSize="16px" />}
            isSelected={project.id === selectedProjectId}
            onActivate={() => onSelectProject(project)}
          />
        );
      })}
    </Stack>
  );
};

const useProjectPickerAccount = (opening: WorkbenchPanelRenderInput["instance"]["pageContext"]) => {
  const configured = opening?.params?.teamAccountId;
  const [picked, setPicked] = useState<{ opening: typeof opening; accountId?: string }>();
  const initialAccountId = typeof configured === "string" ? configured : undefined;
  const accountId = picked?.opening === opening ? picked?.accountId : initialAccountId;
  return [accountId, (selection?: string) => setPicked({ opening, accountId: selection })] as const;
};

export const ProjectPickerWidget = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const { t } = useTranslation("projects");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useProjectPickerAccount(input.instance.pageContext);
  const selectedProjectIdValue = useWorkbenchStore(
    input.workbench.context.store,
    (state) => state.values[dashboardSelectedProjectIdContextKey],
  );
  useProjectNameOperations();
  const dashboardDataVersion = useCollectionSelection({ tables: ["projects", "workspaces"] });

  const selectedProjectId = typeof selectedProjectIdValue === "string" ? selectedProjectIdValue : undefined;
  const catalog = useCloudProjectCatalog(selectedTeamId);
  const team = catalog.teamAccounts.find(({ accountId }) => accountId === selectedTeamId);
  const teamUnavailable = Boolean(selectedTeamId && !team);
  const canCreateProject = !selectedTeamId || (team?.role === "owner" && team.features.relay);
  const teamIds = new Set(catalog.teamAccounts.map(({ accountId }) => accountId));
  const localProjects = teamUnavailable
    ? []
    : createDashboardProjects().filter(({ id }) => {
        const accountId = catalog.teamProjectOwners[id] ?? catalog.teamProjects[id];
        if (selectedTeamId) return accountId === selectedTeamId;
        return !accountId || !teamIds.has(accountId);
      });
  const visibleCatalog = teamUnavailable ? undefined : catalog.data;
  const deletion = useLocalProjectDeletion();
  const allProjects = mergeCloudProjectCatalog(localProjects, visibleCatalog).filter(({ id }) => !deletion.hidden(id));
  const showSearch = allProjects.length >= 8;
  const activeSearchTerm = showSearch ? searchTerm : "";
  const projects = filterProjects(allProjects, activeSearchTerm, dashboardDataVersion);
  const cloudState = useCloudProjectStates(
    localProjects.map((project) => project.id),
    visibleCatalog,
  );

  const handleSelectProject = (project: DashboardProject) => {
    const presence = cloudState(project.id).presence;
    void input.workbench.commands.executeCommand(dashboardCommandIds.selectProject, {
      project: { id: project.id, name: project.name },
      cloudCopyChoice: presence === "cloud-only" || presence === "removing",
    });
  };

  const handleCreateProject = () => {
    void input.workbench.commands.executeCommand(
      dashboardCommandIds.createProject,
      selectedTeamId && { teamAccountId: selectedTeamId },
    );
  };

  return (
    <SearchModalContent
      title={t("title")}
      showSearch={showSearch}
      searchValue={searchTerm}
      searchPlaceholder={t("list.searchPlaceholder")}
      searchIcon={<Search size={14} />}
      searchAutoFocus
      footerStart={
        !selectedProjectId ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void input.workbench.commands.executeCommand(WORKBENCH_SETTINGS_OPEN_COMMAND_ID)}
          >
            <Icon as={Settings} />
            {t("list.settings")}
          </Button>
        ) : undefined
      }
      footerEnd={
        <Button variant="outline" size="sm" onClick={handleCreateProject} disabled={!canCreateProject}>
          <Icon as={Plus} />
          {t("list.createProject")}
        </Button>
      }
      scrollAreaProps={{ maxH: "24rem", viewportProps: { overscrollBehavior: "contain" }, p: "0", gap: "0" }}
      onSearchChange={setSearchTerm}
    >
      {(catalog.teamAccounts.length > 0 || selectedTeamId !== undefined) && (
        <HStack gap="xs" px="sm" py="xs" aria-label="Cloud account" role="group" flexWrap="wrap">
          <Button size="xs" variant="ghost" aria-pressed={!selectedTeamId} onClick={() => setSelectedTeamId(undefined)}>
            Personal
          </Button>
          {catalog.teamAccounts.map(({ accountId, name }) => (
            <Button
              key={accountId}
              size="xs"
              variant="ghost"
              aria-pressed={selectedTeamId === accountId}
              onClick={() => setSelectedTeamId(accountId)}
            >
              {name}
            </Button>
          ))}
        </HStack>
      )}
      {teamUnavailable ? (
        <Text role="status" px="sm" py="md" textStyle="paragraph/S/regular" color="fg.muted">
          This team is unavailable.
        </Text>
      ) : (
        <ProjectPickerRows
          projects={projects}
          selectedProjectId={selectedProjectId}
          searchTerm={activeSearchTerm}
          cloudState={cloudState}
          onSelectProject={handleSelectProject}
        />
      )}
    </SearchModalContent>
  );
};
