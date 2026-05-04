import { getBundledSkills } from "pstdio-agents";
import type { SkillsRouteDeps } from "./deps";

export const seedDefaultSkills = async (deps: SkillsRouteDeps, projectId: string) => {
  const bundled = await getBundledSkills();

  for (const skill of bundled) {
    const existing = await deps.skillService.getByName(projectId, skill.name);
    if (existing) continue;

    await deps.skillService.create({
      project_id: projectId,
      name: skill.name,
      description: skill.description,
      files: skill.files,
    });
  }
};
