import { describe, expect, type Mock, mock, test } from "bun:test";
import { createHandler } from "./list";

const makeDeps = (overrides: Partial<Parameters<typeof createHandler>[0]> = {}) => {
  const log = (overrides.log ?? mock()) as Mock<(msg: string) => void>;
  return {
    cwd: () => "/fake/repo",
    findGitRoot: () => "/fake/repo",
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
        ] as any[],
    ),
    ...overrides,
    log,
  };
};

describe("sessions list", () => {
  test("lists sessions", async () => {
    const deps = makeDeps();
    const handler = createHandler(deps);

    await handler({} as any);

    const output = deps.log.mock.calls[0][0] as string;
    expect(output).toContain("s_abc123");
    expect(output).toContain("completed");
    expect(output).toContain("claude-code");
  });

  test("shows empty message when no sessions", async () => {
    const deps = makeDeps({ listSessions: mock(async () => []) });
    const handler = createHandler(deps);

    await handler({} as any);

    const output = deps.log.mock.calls[0][0] as string;
    expect(output).toBe("No sessions found.");
  });

  test("throws when no project context", async () => {
    const deps = makeDeps({ findGitRoot: () => null, readConfig: () => null });
    const handler = createHandler(deps);

    expect(handler({} as any)).rejects.toThrow("Not inside a pstdio project");
  });

  test("uses --project-id flag", async () => {
    const listSessions = mock(async () => []);
    const deps = makeDeps({ listSessions });
    const handler = createHandler(deps);

    await handler({ "project-id": "other-id" } as any);

    expect(listSessions).toHaveBeenCalledWith(expect.any(String), "other-id", expect.any(Object));
  });
});
