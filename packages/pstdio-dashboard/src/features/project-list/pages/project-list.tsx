import { Button, Container, IconButton, Menu, Stack, Text } from "@chakra-ui/react";
import { EmptyState, MenuItem, toaster } from "@pstdio/ui";
import { useNavigate } from "@tanstack/react-router";
import { Folder, Settings } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CreateProjectDialog } from "../components/create-project-dialog";
import type { CreateProjectInput } from "../data/api";
import { useCreateProject, useProjectList } from "../hooks/use-project-list";

export const ProjectList = () => {
  const { data, isLoading } = useProjectList();
  const createProject = useCreateProject();
  const [isDialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();
  const projects = data ?? [];
  const { t } = useTranslation("projects");

  const handleOpenDialog = () => setDialogOpen(true);
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
      navigate({ to: "/projects/$projectId/docs", params: { projectId: project.id } });
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "Unable to create project.";
      toaster.create({
        type: "error",
        title: t("list.createProjectFailed"),
        description: message,
      });
    }
  };

  const handleProjectSelect = (projectId: string) => {
    navigate({ to: "/projects/$projectId/docs", params: { projectId } });
  };

  const description = isLoading ? "" : t("list.projectCount", { count: projects.length });

  return (
    <Container>
      <Stack gap="lg" padding="lg">
        <Stack gap="2xs">
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Text textStyle="heading/M">{t("list.title")}</Text>
            <Stack direction="row" gap="xs">
              <IconButton size="sm" variant="ghost" aria-label="Settings" onClick={() => navigate({ to: "/settings" })}>
                <Settings size={18} />
              </IconButton>
              <Button size="sm" variant="solid" onClick={handleOpenDialog}>
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
            <Button size="sm" variant="outline" onClick={handleOpenDialog}>
              {t("list.createFirstProject")}
            </Button>
          </EmptyState>
        ) : (
          <Stack gap="xs">
            {projects.map((project) => (
              <Menu.Root key={project.id}>
                <MenuItem
                  id={project.id}
                  primaryLabel={project.name}
                  secondaryLabel={project.repoPath ?? t("chatInput.repo.noneLinked")}
                  leftIcon={Folder}
                  onClick={() => handleProjectSelect(project.id)}
                />
              </Menu.Root>
            ))}
          </Stack>
        )}
      </Stack>

      <CreateProjectDialog
        open={isDialogOpen}
        onClose={handleCloseDialog}
        onCreate={handleCreateProject}
        isSubmitting={createProject.isPending}
      />
    </Container>
  );
};
