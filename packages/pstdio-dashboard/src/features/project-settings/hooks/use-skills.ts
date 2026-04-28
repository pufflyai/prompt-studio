import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  copyProjectSkill,
  disableProjectSkillDefault,
  getProjectSkill,
  getProjectSkills,
  updateProjectSkill,
} from "../data/skills-api";

export const useProjectSkills = (projectId: string | undefined) =>
  useQuery({
    queryKey: ["project-skills", projectId],
    queryFn: () => getProjectSkills(projectId!),
    enabled: Boolean(projectId),
  });

export const useProjectSkill = (projectId: string | undefined, skillName: string | undefined) =>
  useQuery({
    queryKey: ["project-skill", projectId, skillName],
    queryFn: () => getProjectSkill(projectId!, skillName!),
    enabled: Boolean(projectId && skillName),
  });

export const useUpdateProjectSkill = (projectId: string | undefined, skillName: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => updateProjectSkill(projectId!, skillName!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-skill", projectId, skillName] });
      queryClient.invalidateQueries({ queryKey: ["project-skills", projectId] });
    },
  });
};

export const useCopyProjectSkill = (projectId: string | undefined, skillName: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!projectId || !skillName) throw new Error("Project id and skill name are required.");
      return copyProjectSkill(projectId, skillName);
    },
    onSuccess: (skill) => {
      queryClient.invalidateQueries({ queryKey: ["project-skill", projectId, skill.name] });
      queryClient.invalidateQueries({ queryKey: ["project-skills", projectId] });
    },
  });
};

export const useDisableProjectSkillDefault = (projectId: string | undefined, skillName: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!projectId || !skillName) throw new Error("Project id and skill name are required.");
      return disableProjectSkillDefault(projectId, skillName);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-skill", projectId, skillName] });
      queryClient.invalidateQueries({ queryKey: ["project-skills", projectId] });
    },
  });
};
