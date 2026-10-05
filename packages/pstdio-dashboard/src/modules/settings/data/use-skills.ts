import { useQuery } from "@tanstack/react-query";
import { getProjectSkill } from "./skills-api";

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
