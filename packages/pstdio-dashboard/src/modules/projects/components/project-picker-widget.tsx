import { Box, Button, Icon, Stack, Text } from "@chakra-ui/react";
import { EmptyState, ListRow, SearchModalContent } from "@pstdio/ui";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { useWorkbenchStore } from "@pstdio/workbench/react";
import { Folder, Plus, Search } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { dashboardCommandIds } from "@/shared/app/commands";
import { dashboardSelectedProjectIdContextKey } from "@/shared/app/project-context";
import { getDashboardDataVersion, subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import { createDashboardProjects, type DashboardProject } from "../data/project-data";

const filterProjects = (projects: DashboardProject[], searchTerm: string, _dataVersion: number) => {
  const query = searchTerm.trim().toLowerCase();
  if (!query) return projects;

  return projects.filter((project) => {
    const folderPath = project.folderPath ?? "";
    return project.name.toLowerCase().includes(query) || folderPath.toLowerCase().includes(query);
  });
};

interface ProjectPickerRowsProps {
  projects: DashboardProject[];
  selectedProjectId: string | undefined;
  searchTerm: string;
  onSelectProject: (project: DashboardProject) => void;
}

const ProjectPickerRows = (props: ProjectPickerRowsProps) => {
  const { projects, selectedProjectId, searchTerm, onSelectProject } = props;
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
      {projects.map((project) => (
        <ListRow
          key={project.id}
          variant="full-width"
          id={project.id}
          label={project.name}
          description={project.folderPath ?? "No workspace attached"}
          icon={<Icon as={Folder} boxSize="16px" />}
          isSelected={project.id === selectedProjectId}
          onActivate={() => onSelectProject(project)}
        />
      ))}
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
  const projects = filterProjects(createDashboardProjects(), searchTerm, dashboardDataVersion);

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
      searchValue={searchTerm}
      searchPlaceholder={t("list.searchPlaceholder")}
      searchIcon={<Search size={14} />}
      searchAutoFocus
      footerEnd={
        <Button variant="outline" size="xs" onClick={handleCreateProject}>
          <Icon as={Plus} boxSize="14px" />
          {t("list.createProject")}
        </Button>
      }
      scrollAreaProps={{ maxH: "24rem", viewportProps: { overscrollBehavior: "contain" }, p: "0", gap: "0" }}
      onSearchChange={setSearchTerm}
    >
      <ProjectPickerRows
        projects={projects}
        selectedProjectId={selectedProjectId}
        searchTerm={searchTerm}
        onSelectProject={handleSelectProject}
      />
    </SearchModalContent>
  );
};
