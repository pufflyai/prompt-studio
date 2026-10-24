import { Box, Button, Icon, Stack, Text } from "@chakra-ui/react";
import { EmptyState, ListRow, SearchModalContent } from "@pstdio/ui";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { useWorkbenchStore, WORKBENCH_SETTINGS_OPEN_COMMAND_ID } from "@pstdio/workbench/react";
import { Cloud, Folder, Plus, Search, Settings } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { dashboardCommandIds } from "@/shared/app/commands";
import { dashboardSelectedProjectIdContextKey } from "@/shared/app/project-context";
import { getDashboardDataVersion, subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import { type ProjectCloudState, useCloudProjectStates } from "../data/cloud-project-states";
import { createDashboardProjects, type DashboardProject } from "../data/project-data";
import { projectLocationKey } from "../data/project-location";

const filterProjects = (projects: DashboardProject[], searchTerm: string, _dataVersion: number) => {
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

export const ProjectPickerWidget = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const { t } = useTranslation("projects");
  const [searchTerm, setSearchTerm] = useState("");
  const selectedProjectIdValue = useWorkbenchStore(
    input.workbench.context.store,
    (state) => state.values[dashboardSelectedProjectIdContextKey],
  );
  const dashboardDataVersion = useSyncExternalStore(
    subscribeDashboardData,
    getDashboardDataVersion,
    getDashboardDataVersion,
  );

  const selectedProjectId = typeof selectedProjectIdValue === "string" ? selectedProjectIdValue : undefined;
  const allProjects = createDashboardProjects();
  const showSearch = allProjects.length >= 8;
  const activeSearchTerm = showSearch ? searchTerm : "";
  const projects = filterProjects(allProjects, activeSearchTerm, dashboardDataVersion);
  const cloudState = useCloudProjectStates(allProjects.map((project) => project.id));

  const handleSelectProject = (project: DashboardProject) => {
    void input.workbench.commands.executeCommand(dashboardCommandIds.selectProject, {
      project: { id: project.id, name: project.name },
    });
  };

  const handleCreateProject = () => {
    void input.workbench.commands.executeCommand(dashboardCommandIds.createProject);
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
        <Button variant="outline" size="sm" onClick={handleCreateProject}>
          <Icon as={Plus} />
          {t("list.createProject")}
        </Button>
      }
      scrollAreaProps={{ maxH: "24rem", viewportProps: { overscrollBehavior: "contain" }, p: "0", gap: "0" }}
      onSearchChange={setSearchTerm}
    >
      <ProjectPickerRows
        projects={projects}
        selectedProjectId={selectedProjectId}
        searchTerm={activeSearchTerm}
        cloudState={cloudState}
        onSelectProject={handleSelectProject}
      />
    </SearchModalContent>
  );
};
