import { Box, Button, Icon, Stack, Text } from "@chakra-ui/react";
import { EmptyState, ListRow, SearchModalContent } from "@pstdio/ui";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { useWorkbenchStore } from "@pstdio/workbench/react";
import { Folder, Plus, Search } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { useAgents } from "@/shared/agents/use-agents";
import { dashboardCommandIds } from "@/shared/app/commands";
import { dashboardSelectedProjectIdContextKey } from "@/shared/app/project-context";
import { getDashboardDataVersion, subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import { createDashboardProjects, type DashboardProject } from "../data/project-data";
import { resolveProjectCreationAvailability } from "./create-project-state";

const filterProjects = (projects: DashboardProject[], searchTerm: string, _dataVersion: number) => {
  const query = searchTerm.trim().toLowerCase();
  if (!query) return projects;

  return projects.filter((project) => {
    const repoPath = project.repoPath ?? "";
    return project.name.toLowerCase().includes(query) || repoPath.toLowerCase().includes(query);
  });
};

const isPlacementOpen = (input: WorkbenchPanelRenderInput) =>
  Object.values(input.workbench.layout.getLayout().regions).some((region) =>
    region.widgets.some((placement) => placement.widgetId === input.instance.instanceId),
  );

interface ProjectPickerRowsProps {
  projects: DashboardProject[];
  selectedProjectId: string | undefined;
  searchTerm: string;
  onSelectProject: (project: DashboardProject) => void;
}

interface ProjectListBannersProps {
  showAgentErrorBanner: boolean;
  onRetryAgents: () => void;
}

const ProjectListBanners = (props: ProjectListBannersProps) => {
  const { showAgentErrorBanner, onRetryAgents } = props;
  const { t } = useTranslation("projects");

  if (!showAgentErrorBanner) return null;

  return (
    <Stack gap="sm">
      {showAgentErrorBanner ? (
        <Stack borderWidth="1px" borderColor="red.300" bg="red.50" borderRadius="md" p="sm" gap="xs">
          <Stack gap="2xs">
            <Text textStyle="label/M/medium" color="red.900">
              {t("list.agentLoadErrorBanner.title")}
            </Text>
            <Text textStyle="paragraph/S/regular" color="red.800">
              {t("list.agentLoadErrorBanner.description")}
            </Text>
          </Stack>
          <Stack direction="row" justifyContent="flex-end">
            <Button size="xs" variant="outline" onClick={onRetryAgents}>
              {t("list.agentLoadErrorBanner.retry")}
            </Button>
          </Stack>
        </Stack>
      ) : null}
    </Stack>
  );
};

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
          description={project.repoPath ?? t("chatInput.repo.noneLinked")}
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
  const agentsQuery = useAgents();
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
  const availability = resolveProjectCreationAvailability({
    agentInfo: agentsQuery.data ?? [],
    isAgentsLoading: agentsQuery.isLoading,
    isAgentsError: agentsQuery.isError,
  });

  const handleSelectProject = (project: DashboardProject) => {
    void input.workbench.resources.openResource(project.resource, { replaceActive: true }).then(() => {
      if (input.instance.closable === true && isPlacementOpen(input)) {
        input.workbench.layout.closePanel(input.instance.instanceId);
      }
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
      bodyBefore={
        availability.showAgentErrorBanner ? (
          <Box px="sm" pt="sm">
            <ProjectListBanners showAgentErrorBanner onRetryAgents={() => void agentsQuery.refetch()} />
          </Box>
        ) : null
      }
      footerEnd={
        <Button
          variant="outline"
          size="xs"
          disabled={availability.isCreateProjectBlocked}
          onClick={handleCreateProject}
        >
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
