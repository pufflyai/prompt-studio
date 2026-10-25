import { describe, expect, mock, test } from "bun:test";
import { createHandler } from "./list";

describe("projects list", () => {
  test("prints table when projects exist", async () => {
    const log = mock();
    const handler = createHandler({
      listProjects: async () => [
        {
          id: "aaa",
          name: "alpha",
          shorthand: "A",
          selected_agents: [],
          default_agent_id: null,
          default_agent_model: null,
          startup_script: null,
          created_at: "2026-01-15T00:00:00.000Z",
          updated_at: "2026-01-15T00:00:00.000Z",
          deleted_at: null,
        },
        {
          id: "bbb",
          name: "beta",
          shorthand: "B",
          selected_agents: [],
          default_agent_id: null,
          default_agent_model: null,
          startup_script: null,
          created_at: "2026-02-20T00:00:00.000Z",
          updated_at: "2026-02-20T00:00:00.000Z",
          deleted_at: null,
        },
      ],
      log,
    });

    await handler();

    expect(log).toHaveBeenCalledWith(expect.stringContaining("aaa"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("alpha"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("2026-01-15"));
  });

  test("prints message when no projects exist", async () => {
    const log = mock();
    const handler = createHandler({
      listProjects: async () => [],
      log,
    });

    await handler();

    expect(log).toHaveBeenCalledWith("No projects found. Run `pstdio projects create [name]` to create one.");
  });
});
