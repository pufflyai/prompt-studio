import { Box, Button, Dialog, Icon, Input, InputGroup, Stack, Text } from "@chakra-ui/react";
import { EmptyState, Header, ListRow, ScrollArea } from "@pstdio/ui";
import { Folder, Plus, Search } from "lucide-react";
import type { WorkbenchWidgetRenderInput } from "pstdio-workbench/react";
import { useWorkbenchStore } from "pstdio-workbench/react";
import { useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { useAgents } from "@/shared/agents/use-agents";
import { dashboardCommandIds } from "@/shared/app/commands";
import { dashboardSelectedProjectIdContextKey } from "@/shared/app/project-context";
import { getDashboardDataVersion, subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import { createDashboardProjects, type DashboardProject } from "../data/project-data";
import { resolveProjectCreationAvailability } from "./create-project-state";

const searchInputBorderProps = {
  borderColor: "border.muted",
  boxShadow: "none",
  outline: "none",
} as const;

const filterProjects = (projects: DashboardProject[], searchTerm: string, _dataVersion: number) => {
  const query = searchTerm.trim().toLowerCase();
  if (!query) return projects;

  return projects.filter((project) => {
    const repoPath = project.repoPath ?? "";
    return project.name.toLowerCase().includes(query) || repoPath.toLowerCase().includes(query);
  });
};

const isPlacementOpen = (input: WorkbenchWidgetRenderInput) =>
  Object.values(input.workbench.layout.getLayout().areas).some((area) =>
    area.widgets.some((placement) => placement.widgetId === input.placement.widgetId),
  );

interface ProjectPickerRowsProps {
  projects: DashboardProject[];
  selectedProjectId: string | undefined;
  searchTerm: string;
  isCreateProjectDisabled: boolean;
  onCreateProject: () => void;
  onSelectProject: (project: DashboardProject) => void;
}

interface ProjectListBannersProps {
  showNoAgentsBanner: boolean;
  showAgentErrorBanner: boolean;
  onRetryAgents: () => void;
}

const ProjectListBanners = (props: ProjectListBannersProps) => {
  const { showNoAgentsBanner, showAgentErrorBanner, onRetryAgents } = props;
  const { t } = useTranslation("projects");

  if (!showNoAgentsBanner && !showAgentErrorBanner) return null;

  return (
    <Stack gap="sm">
      {showNoAgentsBanner ? (
        <Stack borderWidth="1px" borderColor="orange.300" bg="orange.50" borderRadius="md" p="sm" gap="2xs">
          <Text textStyle="label/M/medium" color="orange.900">
            {t("list.noAgentsBanner.title")}
          </Text>
          <Text textStyle="paragraph/S/regular" color="orange.800">
            {t("list.noAgentsBanner.description")}
          </Text>
        </Stack>
      ) : null}

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
  const { projects, selectedProjectId, searchTerm, isCreateProjectDisabled, onCreateProject, onSelectProject } = props;
  const { t } = useTranslation("projects");
  const createProjectRow = (
    <ListRow
      variant="compact"
      id="create-project"
      label={t("list.createProject")}
      icon={<Icon as={Plus} boxSize="16px" />}
      disabled={isCreateProjectDisabled}
      onActivate={onCreateProject}
    />
  );

  if (projects.length === 0 && searchTerm.trim().length > 0) {
    return (
      <Stack gap="0">
        {createProjectRow}
        <Box px="sm" py="sm">
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            {t("list.noSearchResults")}
          </Text>
        </Box>
      </Stack>
    );
  }

  if (projects.length === 0) {
    return (
      <Stack gap="0">
        {createProjectRow}
        <Box px="sm" py="md">
          <EmptyState title={t("list.noProjectsYet")} description={t("list.noProjectsDescription")} />
        </Box>
      </Stack>
    );
  }

  return (
    <Stack gap="0">
      {createProjectRow}
      {projects.map((project) => (
        <ListRow
          key={project.id}
          variant="compact"
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

export const ProjectPickerWidget = (props: { input: WorkbenchWidgetRenderInput }) => {
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
      if (input.placement.closable === true && isPlacementOpen(input)) {
        input.workbench.layout.closeWidget(input.placement.widgetId);
      }
    });
  };

  const handleCreateProject = () => {
    void input.workbench.commands.executeCommand(dashboardCommandIds.createProject);
  };

  return (
    <>
      <Dialog.Header py="xs" px="sm">
        <Text textStyle="label/S/medium">{t("list.title")}</Text>
      </Dialog.Header>
      <Dialog.Body px="sm" py="sm">
        <Stack gap="sm">
          <ProjectListBanners
            showNoAgentsBanner={availability.showNoAgentsBanner}
            showAgentErrorBanner={availability.showAgentErrorBanner}
            onRetryAgents={() => void agentsQuery.refetch()}
          />
          <Box borderWidth="1px" borderColor="border.muted" borderRadius="md" overflow="hidden">
            <Header as="div" variant="input" borderBottomWidth="1px" borderColor="border.muted" flexShrink={0}>
              <InputGroup startElement={<Search size={14} />} width="full">
                <Input
                  borderWidth="0"
                  borderRadius="0"
                  height="full"
                  value={searchTerm}
                  placeholder={t("list.searchPlaceholder")}
                  aria-label={t("list.searchPlaceholder")}
                  autoComplete="off"
                  autoFocus
                  _hover={searchInputBorderProps}
                  _active={searchInputBorderProps}
                  _focus={searchInputBorderProps}
                  _focusVisible={searchInputBorderProps}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </InputGroup>
            </Header>
            <ScrollArea maxH="22rem" viewportProps={{ overscrollBehavior: "contain" }} p="0" gap="0">
              <ProjectPickerRows
                projects={projects}
                selectedProjectId={selectedProjectId}
                searchTerm={searchTerm}
                isCreateProjectDisabled={availability.isCreateProjectBlocked}
                onCreateProject={handleCreateProject}
                onSelectProject={handleSelectProject}
              />
            </ScrollArea>
          </Box>
        </Stack>
      </Dialog.Body>
    </>
  );
};
