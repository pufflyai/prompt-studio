import { Button, Container, IconButton, Menu, Stack, Text } from "@chakra-ui/react";
import { EmptyState, MenuItem, toaster } from "@pstdio/ui";
import { useNavigate } from "@tanstack/react-router";
import { format, isSameYear, parseISO } from "date-fns";
import { Folder, Settings } from "lucide-react";
import { useState } from "react";
import { CreateProjectDialog } from "../components/create-project-dialog";
import type { CreateProjectInput } from "../data/api";
import { useCreateProject, useProjectList } from "../hooks/use-project-list";
import type { ProjectListItem } from "../types";

const getTimeFormat = (time: string) => {
  const parsedTime = parseISO(time);
  const currentTime = new Date();

  if (isSameYear(parsedTime, currentTime)) {
    return format(parsedTime, "HH:mm MMM dd");
  }

  return format(parsedTime, "HH:mm MMM dd, yyyy");
};

const formatProjectSummary = (project: ProjectListItem) => `Updated ${getTimeFormat(project.updatedAt)}`;

export const ProjectList = () => {
  const { data, isLoading, isError, error } = useProjectList();
  const createProject = useCreateProject();
  const [isDialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();
  const projects = data ?? [];

  const handleOpenDialog = () => setDialogOpen(true);
  const handleCloseDialog = () => setDialogOpen(false);

  const handleCreateProject = async (input: CreateProjectInput) => {
    try {
      await createProject.mutateAsync(input);
      setDialogOpen(false);
      toaster.create({
        type: "success",
        title: "Project created",
        description: input.name,
      });
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "Unable to create project.";
      toaster.create({
        type: "error",
        title: "Create project failed",
        description: message,
      });
    }
  };

  const handleProjectSelect = (projectId: string) => {
    navigate({ to: "/projects/$projectId/tickets", params: { projectId } });
  };

  const description = isLoading ? "" : `You have ${projects.length} project${projects.length === 1 ? "" : "s"}.`;

  return (
    <Container>
      <Stack gap="lg" padding="lg">
        <Stack gap="2xs">
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Text textStyle="heading/M">Projects</Text>
            <Stack direction="row" gap="xs">
              <IconButton size="sm" variant="ghost" aria-label="Settings" onClick={() => navigate({ to: "/settings" })}>
                <Settings size={18} />
              </IconButton>
              <Button size="sm" variant="solid" onClick={handleOpenDialog}>
                Create project
              </Button>
            </Stack>
          </Stack>
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            {description}
          </Text>
        </Stack>

        {isLoading ? (
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            Loading projects...
          </Text>
        ) : isError ? (
          <EmptyState
            title="Unable to load projects"
            description={error instanceof Error ? error.message : undefined}
          />
        ) : projects.length === 0 ? (
          <EmptyState title="No projects yet" description="Create your first project to get started.">
            <Button size="sm" variant="outline" onClick={handleOpenDialog}>
              Create your first project
            </Button>
          </EmptyState>
        ) : (
          <Stack gap="xs">
            {projects.map((project) => (
              <Menu.Root key={project.id}>
                <MenuItem
                  id={project.id}
                  primaryLabel={project.name}
                  secondaryLabel={formatProjectSummary(project)}
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
