import { expect, test } from "bun:test";
import { createTestApp } from "../../../test-utils/create-test-app";

test("skill queries page resolved skills with canonical fields and a terminal null", async () => {
  const { app, deps, close } = await createTestApp();
  try {
    const project = await deps.projectService.create({ name: "Skill pages" });
    const other = await deps.projectService.create({ name: "Other skills" });
    for (let index = 0; index < 52; index++) {
      await deps.skillService.create({
        project_id: project.id,
        name: `skill-${index}`,
        description: "A skill",
        files: [],
      });
    }
    await deps.skillService.create({ project_id: other.id, name: "other", description: "Other", files: [] });
    const response = await app.request(`/v1/projects/${project.id}/skills/query`);
    expect(response.status).toBe(200);
    const first = await response.json();
    expect(first.items).toHaveLength(50);
    expect(
      first.items.every(
        (item: { projectId: string; sourceKind: string }) =>
          item.projectId === project.id && item.sourceKind === "project",
      ),
    ).toBe(true);
    const last = await (await app.request(`/v1/projects/${project.id}/skills/query?cursor=${first.nextCursor}`)).json();
    expect(last.items).toHaveLength(2);
    expect(last.nextCursor).toBeNull();
    expect(new Set([...first.items, ...last.items].map((item) => item.id)).size).toBe(52);
    const legacy = await (await app.request(`/v1/projects/${project.id}/skills`)).json();
    expect(legacy).toHaveLength(52);
    expect(legacy[0].projectId).toBe(legacy[0].project_id);
    const skill = await (await app.request(`/v1/projects/${project.id}/skills/${legacy[0].name}`)).json();
    expect(skill.projectId).toBe(project.id);
    expect(skill.installedAgents).toEqual(skill.installed_agents);
  } finally {
    await close();
  }
});
