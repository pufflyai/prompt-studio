import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getProjectSkill, updateProjectSkillInstallation } from "./skills-api";

const projectSkillsQueryKey = (projectId: string | undefined) => ["project-skills", projectId];
const projectSkillQueryKey = (projectId: string | undefined, skillName: string | undefined) => [
  "project-skill",
  projectId,
  skillName,
];

export const useProjectSkill = (projectId: string | undefined, skillName: string | undefined) =>
  useQuery({
    queryKey: projectSkillQueryKey(projectId, skillName),
    queryFn: () => getProjectSkill(projectId!, skillName!),
    enabled: Boolean(projectId && skillName),
  });

export const useUpdateProjectSkillInstallation = (projectId: string | undefined, skillName: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => updateProjectSkillInstallation(projectId!, skillName!),
    onSuccess: (skill) => {
      // Seed the fresh status immediately, then refetch so the viewer reflects server truth.
      queryClient.setQueryData(projectSkillQueryKey(projectId, skillName), skill);
      queryClient.invalidateQueries({ queryKey: projectSkillQueryKey(projectId, skillName) });
      queryClient.invalidateQueries({ queryKey: projectSkillsQueryKey(projectId) });
    },
  });
};
