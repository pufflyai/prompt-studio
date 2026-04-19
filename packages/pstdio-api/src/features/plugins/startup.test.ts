import { describe, expect, mock, test } from "bun:test";
import type { RouteDeps } from "../deps";
import { startProjectSchedulers } from "./startup";

const createMockDeps = () =>
  ({
    projectService: {
      list: mock(() => Promise.resolve([])),
    },
    pluginService: {
      getForProject: mock(() => Promise.resolve({})),
    },
  }) as unknown as RouteDeps;

describe("startProjectSchedulers", () => {
  test("loads plugin runtime for each project", async () => {
    const deps = createMockDeps();
    (deps.projectService.list as ReturnType<typeof mock>).mockResolvedValue([
      { id: "project-1", name: "P1" },
      { id: "project-2", name: "P2" },
    ]);

    await startProjectSchedulers(deps);

    expect(deps.pluginService.getForProject).toHaveBeenCalledTimes(2);
    expect(deps.pluginService.getForProject).toHaveBeenCalledWith("project-1");
    expect(deps.pluginService.getForProject).toHaveBeenCalledWith("project-2");
  });

  test("does nothing when no projects exist", async () => {
    const deps = createMockDeps();

    await startProjectSchedulers(deps);

    expect(deps.pluginService.getForProject).not.toHaveBeenCalled();
  });

  test("continues loading other projects when one fails", async () => {
    const deps = createMockDeps();
    (deps.projectService.list as ReturnType<typeof mock>).mockResolvedValue([
      { id: "project-1", name: "P1" },
      { id: "project-2", name: "P2" },
      { id: "project-3", name: "P3" },
    ]);
    (deps.pluginService.getForProject as ReturnType<typeof mock>).mockImplementation(async (id: string) => {
      if (id === "project-2") throw new Error("load failed");
      return {};
    });

    await startProjectSchedulers(deps);

    expect(deps.pluginService.getForProject).toHaveBeenCalledTimes(3);
    expect(deps.pluginService.getForProject).toHaveBeenCalledWith("project-3");
  });
});
