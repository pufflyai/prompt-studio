import { useQuery } from "@tanstack/react-query";
import { getProjectSkill, getProjectSkills } from "./skills-api";

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
