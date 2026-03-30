import { describe, expect, mock, test } from "bun:test";
import { createRepoService } from "./repo-service";

describe("RepoService", () => {
  test("listByProject delegates to the DB service", async () => {
    const repos = [{ id: "r1", project_id: "p1" }];
    const listByProject = mock(async () => repos);
    const service = createRepoService({
      reposDBService: { listByProject },
    } as unknown as Parameters<typeof createRepoService>[0]);

    const result = await service.listByProject("p1");

    expect(result as unknown).toBe(repos);
    expect(listByProject).toHaveBeenCalledWith("p1");
  });
});
