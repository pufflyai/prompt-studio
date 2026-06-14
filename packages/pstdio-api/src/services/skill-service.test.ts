import { describe, expect, mock, test } from "bun:test";
import { createSkillService } from "./skill-service";

const fakeFileService = {
  get: mock(async () => ({ storage_path: "/dev/null" })),
  upload: mock(async () => ({ id: "f1" })),
  remove: mock(async () => true),
} as unknown as Parameters<typeof createSkillService>[0]["fileService"];

const fakeExtensionDeps = {
  extensionService: { listEnabledSourcesForProject: mock(async () => []) },
  extensionSkillPreferencesDBService: { list: mock(async () => []) },
} as unknown as Pick<
  Parameters<typeof createSkillService>[0],
  "extensionService" | "extensionSkillPreferencesDBService"
>;

describe("SkillService", () => {
  test("list hydrates file content via fileService", async () => {
    const list = mock(async () => [
      {
        id: "sk1",
        project_id: "p1",
        name: "test-skill",
        description: "",
        files: [{ path: "SKILL.md", file_id: "f1" }],
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        deleted_at: null,
      },
    ]);
    const service = createSkillService({
      ...fakeExtensionDeps,
      skillsDBService: { list } as unknown as Parameters<typeof createSkillService>[0]["skillsDBService"],
      fileService: fakeFileService,
    });

    const result = await service.list("p1");

    expect(result).toHaveLength(1);
    expect(result[0]?.files[0]?.path).toBe("SKILL.md");
    expect(list).toHaveBeenCalled();
  });
});
