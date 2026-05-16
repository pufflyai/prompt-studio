import { toaster } from "@pstdio/ui";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAgents } from "@/features/agents/hooks/use-agents";
import { resolveProjectDefaultPath } from "@/features/project/utils/project-default-path";
import type { CreateProjectInput } from "../data/api";
import { resolveProjectCreationAvailability } from "../utils/availability";
import { filterProjects } from "../utils/filter-projects";
import { useCreateProject, useProjectList } from "./use-project-list";

export const useProjectPicker = () => {
  const { t } = useTranslation("projects");
  const navigate = useNavigate();
  const { data: projects = [], isLoading: isProjectsLoading } = useProjectList();
  const {
    data: agentInfo = [],
    isLoading: isAgentsLoading,
    isError: isAgentsError,
    refetch: refetchAgents,
  } = useAgents();
  const createProject = useCreateProject();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setCreateOpen] = useState(false);

  const filteredProjects = useMemo(() => filterProjects(projects, searchTerm), [projects, searchTerm]);

  const availability = resolveProjectCreationAvailability({
    agentInfo,
    isAgentsLoading,
    isAgentsError,
  });

  const handleCreateProject = async (input: CreateProjectInput) => {
    try {
      const project = await createProject.mutateAsync(input);
      setCreateOpen(false);
      toaster.create({
        type: "success",
        title: t("list.projectCreated"),
        description: input.name,
      });
      navigate({ to: resolveProjectDefaultPath(project.id) });
      return project;
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "Unable to create project.";
      toaster.create({
        type: "error",
        title: t("list.createProjectFailed"),
        description: message,
      });
      return null;
    }
  };

  return {
    projects,
    filteredProjects,
    isProjectsLoading,
    agentInfo,
    availability,
    refetchAgents,
    searchTerm,
    setSearchTerm,
    isCreateOpen,
    openCreate: () => setCreateOpen(true),
    closeCreate: () => setCreateOpen(false),
    createProject: handleCreateProject,
    isCreatePending: createProject.isPending,
  };
};
