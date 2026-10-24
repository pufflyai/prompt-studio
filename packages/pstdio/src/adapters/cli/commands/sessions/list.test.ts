import { describe, expect, type Mock, mock, test } from "bun:test";
import type { Arguments } from "yargs";
import { createHandler, type ListArgs } from "./list";

const argv = (args: Partial<ListArgs> = {}) => ({ _: [], $0: "", ...args }) as Arguments<ListArgs>;

const makeDeps = (overrides: Partial<Parameters<typeof createHandler>[0]> = {}) => {
  const log = (overrides.log ?? mock()) as Mock<(msg: string) => void>;
  return {
    cwd: () => "/fake/repo",
    findProjectRoot: () => "/fake/repo",
    readConfig: () => ({ project_id: "proj-1" }),
    listSessions: mock(
      async () =>
        [
          {
            id: "s_abc123",
            project_id: "proj-1",
            title: "S1",
            status: "completed",
            archived: false,
            agent: "claude-code",
            created_at: "2026-03-05T10:00:00Z",
          },
        ] as never[],
    ),
    ...overrides,
    log,
  };
};

describe("sessions list", () => {
  test("lists sessions", async () => {
    const deps = makeDeps();
    const handler = createHandler(deps);

    await handler(argv());

    const output = deps.log.mock.calls[0][0] as string;
    expect(output).toContain("s_abc123");
    expect(output).toContain("completed");
    expect(output).toContain("claude-code");
  });

  test("prints complete session records as JSON while applying filters", async () => {
    const sessions = [
      {
        id: "9e596e65-3df1-4fa7-9dcc-f9b516d7c43c",
        title: "Work in progress",
        status: "in_progress",
        agent: "pstdio.harness-codex.harness.codex",
        workspace_id: "workspace-1",
        created_at: "2026-10-22T10:00:00Z",
        last_request_started: "2026-10-22T10:01:00Z",
      },
    ];
    const listSessions = mock(async () => sessions as never[]);
    const deps = makeDeps({ listSessions });

    await createHandler(deps)(argv({ json: true, status: "in_progress", "workspace-id": "workspace-1" }));

    expect(deps.log).toHaveBeenCalledTimes(1);
    expect(JSON.parse(deps.log.mock.calls[0][0])).toEqual(sessions);
    expect(listSessions).toHaveBeenCalledWith(
      expect.any(String),
      "proj-1",
      expect.objectContaining({ status: "in_progress", workspaceId: "workspace-1" }),
    );
  });

  test("prints an empty JSON array when no sessions match", async () => {
    const deps = makeDeps({ listSessions: mock(async () => []) });

    await createHandler(deps)(argv({ json: true }));

    expect(deps.log).toHaveBeenCalledTimes(1);
    expect(JSON.parse(deps.log.mock.calls[0][0])).toEqual([]);
  });

  test("shows empty message when no sessions", async () => {
    const deps = makeDeps({ listSessions: mock(async () => []) });
    const handler = createHandler(deps);

    await handler(argv());

    const output = deps.log.mock.calls[0][0] as string;
    expect(output).toBe("No sessions found.");
  });

  test("throws when no project context", async () => {
    const deps = makeDeps({ findProjectRoot: () => null, readConfig: () => null });
    const handler = createHandler(deps);

    expect(handler(argv())).rejects.toThrow("Not inside a pstdio project");
  });

  test("uses --project-id flag", async () => {
    const listSessions = mock(async () => []);
    const deps = makeDeps({ listSessions });
    const handler = createHandler(deps);

    await handler(argv({ "project-id": "other-id" }));

    expect(listSessions).toHaveBeenCalledWith(expect.any(String), "other-id", expect.any(Object));
  });
});

test("session list forwards time and resource filters", async () => {
  const deps = makeDeps();
  await createHandler(deps)(
    argv({
      "created-from": "2026-10-01T00:00:00Z",
      "created-to": "2026-10-02T00:00:00Z",
      "updated-from": "2026-10-01T01:00:00Z",
      "anchor-type": "ticket",
      "anchor-id": "T",
    }),
  );
  expect(deps.listSessions).toHaveBeenCalledWith(
    expect.any(String),
    "proj-1",
    expect.objectContaining({
      createdFrom: "2026-10-01T00:00:00Z",
      createdTo: "2026-10-02T00:00:00Z",
      updatedFrom: "2026-10-01T01:00:00Z",
      anchorType: "ticket",
      anchorId: "T",
    }),
  );
});
