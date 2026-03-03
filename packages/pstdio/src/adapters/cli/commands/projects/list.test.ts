import { describe, expect, mock, test } from "bun:test";
import { createHandler } from "./list";

describe("projects list", () => {
  test("prints table when projects exist", async () => {
    const log = mock();
    const handler = createHandler({
      listProjects: async () => [
        { id: "aaa", name: "alpha", created_at: "2026-01-15T00:00:00.000Z" },
        { id: "bbb", name: "beta", created_at: "2026-02-20T00:00:00.000Z" },
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
