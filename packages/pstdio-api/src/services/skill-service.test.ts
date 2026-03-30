import { describe, expect, mock, test } from "bun:test";
import { createSkillService } from "./skill-service";

describe("SkillService", () => {
  test("DB methods are accessible", async () => {
    const skills = [{ id: "sk1", name: "test-skill" }];
    const list = mock(async () => skills);
    const service = createSkillService({
      skillsDBService: { list },
      skillsStorageService: { listProjectSkills: mock(async () => []) },
    } as unknown as Parameters<typeof createSkillService>[0]);

    const result = await service.list("p1");

    expect(result as unknown).toBe(skills);
    expect(list).toHaveBeenCalled();
  });

  test("storage methods are accessible", async () => {
    const projectSkills = [{ name: "my-skill", path: "/skills/my-skill" }];
    const listProjectSkills = mock(async () => projectSkills);
    const service = createSkillService({
      skillsDBService: { list: mock(async () => []) },
      skillsStorageService: { listProjectSkills },
    } as unknown as Parameters<typeof createSkillService>[0]);

    const result = await service.listProjectSkills("p1", "claude-code");

    expect(result as unknown).toBe(projectSkills);
    expect(listProjectSkills).toHaveBeenCalledWith("p1", "claude-code");
  });
});
