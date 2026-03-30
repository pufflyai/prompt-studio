import { describe, expect, mock, test } from "bun:test";
import { createProjectService } from "./project-service";

describe("ProjectService", () => {
  test("get delegates to the DB service", async () => {
    const project = { id: "p1", name: "Test" };
    const get = mock(async () => project);
    const service = createProjectService({
      projectsDBService: { get },
    } as unknown as Parameters<typeof createProjectService>[0]);

    const result = await service.get("p1");

    expect(result as unknown).toBe(project);
    expect(get).toHaveBeenCalledWith("p1");
  });
});
