import { Button, Container, IconButton, Menu, Stack, Text } from "@chakra-ui/react";
import { EmptyState, MenuItem, toaster } from "@pstdio/ui";
import { Link, useNavigate } from "@tanstack/react-router";
import { Folder, Settings } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAgents } from "@/features/agents/hooks/use-agents";
import type { AgentInfo } from "@/features/agents/types";
import { resolveProjectDefaultPath } from "@/features/project/utils/project-default-path";
import { CreateProjectDialog } from "../components/create-project-dialog";
import type { CreateProjectInput } from "../data/api";
import { useCreateProject, useProjectList } from "../hooks/use-project-list";

type AgentAvailabilityStateInput = {
  agentInfo: AgentInfo[];
  isAgentsLoading: boolean;
  isAgentsError: boolean;
};

export const resolveProjectCreationAvailability = (input: AgentAvailabilityStateInput) => {
  const availableAgents = input.agentInfo.filter((agent) => agent.availability.type === "INSTALLED");
  const hasAvailableAgents = availableAgents.length > 0;
  const showNoAgentsBanner = !input.isAgentsLoading && !input.isAgentsError && !hasAvailableAgents;
  const showAgentErrorBanner = input.isAgentsError;
  const isCreateProjectBlocked = input.isAgentsLoading || showAgentErrorBanner || showNoAgentsBanner;

  return {
    availableAgents,
    showNoAgentsBanner,
    showAgentErrorBanner,
    isCreateProjectBlocked,
  };
};

export const ProjectList = () => {
  const { data, isLoading } = useProjectList();
  const {
    data: agentInfo = [],
    isLoading: isAgentsLoading,
    isError: isAgentsError,
    refetch: refetchAgents,
  } = useAgents();
  const createProject = useCreateProject();
  const [isDialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();
  const projects = data ?? [];
  const { t } = useTranslation("projects");
  const { availableAgents, showNoAgentsBanner, showAgentErrorBanner, isCreateProjectBlocked } =
    resolveProjectCreationAvailability({ agentInfo, isAgentsLoading, isAgentsError });

  const handleOpenDialog = () => {
    if (isCreateProjectBlocked) {
      return;
    }

    setDialogOpen(true);
  };
  const handleCloseDialog = () => setDialogOpen(false);

  const handleCreateProject = async (input: CreateProjectInput) => {
    try {
      const project = await createProject.mutateAsync(input);
      setDialogOpen(false);
      toaster.create({
        type: "success",
        title: t("list.projectCreated"),
        description: input.name,
      });
      navigate({ to: resolveProjectDefaultPath(project.id) });
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "Unable to create project.";
      toaster.create({
        type: "error",
        title: t("list.createProjectFailed"),
        description: message,
      });
    }
  };

  const description = isLoading ? "" : t("list.projectCount", { count: projects.length });

  return (
    <Container>
      <Stack gap="lg" padding="lg">
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
              <Button size="xs" variant="outline" onClick={() => void refetchAgents()}>
                {t("list.agentLoadErrorBanner.retry")}
              </Button>
            </Stack>
          </Stack>
        ) : null}

        <Stack gap="2xs">
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Text textStyle="heading/M">{t("list.title")}</Text>
            <Stack direction="row" gap="xs">
              <IconButton size="sm" variant="ghost" aria-label="Settings" asChild>
                <Link to="/settings">
                  <Settings size={18} />
                </Link>
              </IconButton>
              <Button size="sm" variant="primary" onClick={handleOpenDialog} disabled={isCreateProjectBlocked}>
                {t("list.createProject")}
              </Button>
            </Stack>
          </Stack>
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            {description}
          </Text>
        </Stack>

        {isLoading ? (
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            {t("list.loadingProjects")}
          </Text>
        ) : projects.length === 0 ? (
          <EmptyState title={t("list.noProjectsYet")} description={t("list.noProjectsDescription")}>
            <Button size="sm" variant="outline" onClick={handleOpenDialog} disabled={isCreateProjectBlocked}>
              {t("list.createFirstProject")}
            </Button>
          </EmptyState>
        ) : (
          <Stack gap="xs">
            {projects.map((project) => (
              <Menu.Root key={project.id}>
                <MenuItem
                  asChild
                  id={project.id}
                  primaryLabel={project.name}
                  secondaryLabel={project.repoPath ?? t("chatInput.repo.noneLinked")}
                  leftIcon={Folder}
                >
                  <Link to={resolveProjectDefaultPath(project.id)} />
                </MenuItem>
              </Menu.Root>
            ))}
          </Stack>
        )}
      </Stack>

      <CreateProjectDialog
        open={isDialogOpen}
        onClose={handleCloseDialog}
        onCreate={handleCreateProject}
        availableAgents={availableAgents.map((agent) => ({ id: agent.id, name: agent.name }))}
        isSubmitting={createProject.isPending}
      />
    </Container>
  );
};
