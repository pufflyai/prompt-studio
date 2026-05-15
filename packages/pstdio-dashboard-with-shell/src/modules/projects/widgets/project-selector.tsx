import { Avatar, Button, HStack, Text } from "@chakra-ui/react";
import { toaster } from "@pstdio/ui";
import { ChevronDown } from "lucide-react";
import type { ShellWidgetRenderInput } from "pstdio-shell/react";
import { useShellStore } from "pstdio-shell/react";
import { useEffect, useState } from "react";
import { useAgents } from "../../agents/data/use-agents";
import { CreateProjectDialog } from "../components/create-project-dialog";
import { ProjectListDialog } from "../components/project-list-dialog";
import {
  PROJECTS_OPEN_CREATE_REQUEST_CONTEXT_KEY,
  PROJECTS_OPEN_LIST_REQUEST_CONTEXT_KEY,
  SELECTED_PROJECT_CONTEXT_KEY,
} from "../constants";
import { useCreateProject } from "../data/api";
import { useProjects } from "../data/use-projects";
import type { CreateProjectInput, Project } from "../types";

const resolveSelectedProject = (projects: Project[], selectedId: string | undefined) => {
  if (!selectedId) return null;
  return projects.find((project) => project.id === selectedId) ?? null;
};

const resolveCreateProjectBlockedMessage = (input: {
  isAgentsLoading: boolean;
  isAgentsError: boolean;
  availableAgentCount: number;
}) => {
  if (input.isAgentsLoading) return "Loading agents...";
  if (input.isAgentsError) return "Unable to load agents. Project creation is unavailable.";
  if (input.availableAgentCount === 0)
    return "No installed agents are available. Set up an agent before creating a project.";
  return null;
};

export const ProjectSelector = (props: { input: ShellWidgetRenderInput }) => {
  const { input } = props;
  const { shell } = input;
  const { projects, isLoading } = useProjects();
  const { data: agentInfo = [], isLoading: isAgentsLoading, isError: isAgentsError } = useAgents();
  const selectedId = useShellStore(shell.context.store, (state) => state.values[SELECTED_PROJECT_CONTEXT_KEY]);
  const openListRequest = useShellStore(
    shell.context.store,
    (state) => state.values[PROJECTS_OPEN_LIST_REQUEST_CONTEXT_KEY],
  );
  const openCreateRequest = useShellStore(
    shell.context.store,
    (state) => state.values[PROJECTS_OPEN_CREATE_REQUEST_CONTEXT_KEY],
  );
  const selectedProject = resolveSelectedProject(projects, typeof selectedId === "string" ? selectedId : undefined);
  const createProject = useCreateProject();
  const [isListDialogOpen, setListDialogOpen] = useState(false);
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const availableAgents = agentInfo.filter((agent) => agent.availability.type === "INSTALLED");
  const createProjectBlockedMessage = resolveCreateProjectBlockedMessage({
    isAgentsLoading,
    isAgentsError,
    availableAgentCount: availableAgents.length,
  });
  const isCreateProjectBlocked = createProjectBlockedMessage !== null;

  // Auto-default the selection so downstream modules always see a project id once one exists.
  useEffect(() => {
    if (isLoading) return;
    if (selectedProject) return;
    if (projects.length === 0) return;
    shell.context.set(SELECTED_PROJECT_CONTEXT_KEY, projects[0].id);
  }, [isLoading, selectedProject, projects, shell]);

  useEffect(() => {
    if (typeof openListRequest !== "number") return;
    setListDialogOpen(true);
    shell.context.delete(PROJECTS_OPEN_LIST_REQUEST_CONTEXT_KEY);
  }, [openListRequest, shell]);

  useEffect(() => {
    if (typeof openCreateRequest !== "number") return;
    if (isCreateProjectBlocked) {
      setListDialogOpen(true);
    } else {
      setListDialogOpen(false);
      setCreateDialogOpen(true);
    }
    shell.context.delete(PROJECTS_OPEN_CREATE_REQUEST_CONTEXT_KEY);
  }, [isCreateProjectBlocked, openCreateRequest, shell]);

  const handleSelectProject = (projectId: string) => {
    shell.context.set(SELECTED_PROJECT_CONTEXT_KEY, projectId);
    setListDialogOpen(false);
  };

  const handleOpenCreateProject = () => {
    if (isCreateProjectBlocked) return;
    setListDialogOpen(false);
    setCreateDialogOpen(true);
  };

  const triggerLabel = (() => {
    if (isLoading) return "Loading...";
    if (selectedProject) return selectedProject.name;
    if (projects.length === 0) return "No projects";
    return "Select project";
  })();

  const handleCreateProject = async (form: CreateProjectInput) => {
    try {
      const project = await createProject.mutateAsync(form);
      setCreateDialogOpen(false);
      shell.context.set(SELECTED_PROJECT_CONTEXT_KEY, project.id);
      toaster.create({ type: "success", title: "Project created", description: project.name });
    } catch (error) {
      const description = error instanceof Error ? error.message : "Unable to create project.";
      toaster.create({ type: "error", title: "Create project failed", description });
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        width="full"
        justifyContent="flex-start"
        px="xs"
        onClick={() => setListDialogOpen(true)}
      >
        <HStack gap="xs" minW="0" flex="1">
          <Avatar.Root size="2xs" flexShrink={0}>
            <Avatar.Fallback name={triggerLabel} />
          </Avatar.Root>
          <Text textStyle="label/M/medium" truncate>
            {triggerLabel}
          </Text>
        </HStack>
        <ChevronDown size={14} />
      </Button>

      <ProjectListDialog
        open={isListDialogOpen}
        projects={projects}
        selectedProjectId={selectedProject?.id ?? null}
        isLoading={isLoading}
        isCreateProjectBlocked={isCreateProjectBlocked}
        createProjectBlockedMessage={createProjectBlockedMessage}
        onClose={() => setListDialogOpen(false)}
        onSelectProject={handleSelectProject}
        onOpenCreateProject={handleOpenCreateProject}
      />

      <CreateProjectDialog
        open={isCreateDialogOpen}
        availableAgents={availableAgents.map((agent) => ({ id: agent.id, name: agent.name }))}
        isSubmitting={createProject.isPending}
        onClose={() => setCreateDialogOpen(false)}
        onCreate={handleCreateProject}
      />
    </>
  );
};
