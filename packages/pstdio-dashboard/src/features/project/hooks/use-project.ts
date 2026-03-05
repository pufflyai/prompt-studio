import { useQuery } from "@tanstack/react-query";

import {
  getProject,
  getProjectRepositories,
  getProjectTemplateAssets,
  getSystemInfo,
} from "@/features/project/data/api";
import { projectKeys } from "./keys";

export const useProject = (projectId: string | undefined) =>
  useQuery({
    queryKey: projectKeys.detail(projectId ?? ""),
    queryFn: () => getProject(projectId ?? ""),
    enabled: Boolean(projectId),
  });

export const useProjectRepositories = (projectId: string | undefined) =>
  useQuery({
    queryKey: projectKeys.repositories(projectId ?? ""),
    queryFn: () => getProjectRepositories(projectId ?? ""),
    enabled: Boolean(projectId),
  });

export const useProjectTemplateAssets = (projectId: string | undefined) =>
  useQuery({
    queryKey: projectKeys.templateAssets(projectId ?? ""),
    queryFn: () => getProjectTemplateAssets(projectId ?? ""),
    enabled: Boolean(projectId),
  });

export const useSystemInfo = () =>
  useQuery({
    queryKey: projectKeys.info(),
    queryFn: () => getSystemInfo(),
  });
