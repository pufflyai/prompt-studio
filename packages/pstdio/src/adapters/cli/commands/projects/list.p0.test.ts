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

test.each([false, true, undefined])("Cloud listing preserves membership certainty %s", async (membershipKnown) => {
  const log = mock();
  const account = { accountId: "account-x", managerOrigin: "https://manager.example" };
  const handler = createHandler({
    log,
    listProjects: async () => [
      {
        id: "local-copy",
        name: "Downloaded notes",
        shorthand: "N",
        selected_agents: [],
        default_agent_id: null,
        default_agent_model: null,
        startup_script: null,
        created_at: "2026-01-15T00:00:00.000Z",
        updated_at: "2026-01-15T00:00:00.000Z",
        deleted_at: null,
      },
    ],
    listCloudProjects: async () => ({ projects: [], deletions: [], account, membershipKnown }),
  });
  await handler({ cloud: true, _: [], $0: "pstdio" });
  const result = JSON.parse(log.mock.calls[0][0]);
  expect(result.membershipKnown).toBe(membershipKnown);
  expect(result.account).toEqual(account);
  expect(result.projects).toEqual([
    { id: "local-copy", name: "Downloaded notes", presence: membershipKnown === false ? "unknown" : "local" },
  ]);
});
