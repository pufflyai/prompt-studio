import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getProjectSkill, getProjectSkills, updateProjectSkillInstallation } from "./skills-api";

const projectSkillsQueryKey = (projectId: string | undefined) => ["project-skills", projectId];
const projectSkillQueryKey = (projectId: string | undefined, skillName: string | undefined) => [
  "project-skill",
  projectId,
  skillName,
];

export const useProjectSkills = (projectId: string | undefined) =>
  useQuery({
    queryKey: projectSkillsQueryKey(projectId),
    queryFn: () => getProjectSkills(projectId!),
    enabled: Boolean(projectId),
  });

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
      queryClient.setQueryData(projectSkillQueryKey(projectId, skillName), skill);
      queryClient.invalidateQueries({ queryKey: projectSkillsQueryKey(projectId) });
    },
  });
};
