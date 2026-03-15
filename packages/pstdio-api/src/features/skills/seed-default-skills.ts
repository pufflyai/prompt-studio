import { getBundledSkills } from "pstdio-agents";
import type { RouteDeps } from "../deps";

export const seedDefaultSkills = async (deps: RouteDeps, projectId: string) => {
  const bundled = await getBundledSkills();

  for (const skill of bundled) {
    const existing = await deps.skillsDbService.getByName(projectId, skill.name);
    if (existing) continue;

    const file = await deps.filesService.upload({
      project_id: projectId,
      file_name: `${skill.name}.md`,
      file_kind: "skill",
      data: Buffer.from(skill.content),
      mime_type: "text/markdown",
    });

    await deps.skillsDbService.create({
      project_id: projectId,
      name: skill.name,
      description: skill.description,
      file_id: file.id,
    });
  }
};
