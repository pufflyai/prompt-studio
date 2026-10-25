import { expect, test } from "bun:test";
import extension from "./extension";

const command = extension.commands?.find((contribution) => contribution.id === "merge-queue.repair-removed");

const removedPulls = [
  {
    number: 1363,
    headRefName: "bugfix/windows",
    headRefOid: "57c9853270aaaaaa",
    url: "https://x/1363",
    isCrossRepository: false,
    timelineItems: { nodes: [{ createdAt: "2026-10-24T06:00:00Z" }] },
  },
  {
    number: 1371,
    headRefName: "bugfix/stabilize",
    headRefOid: "787e8ec0f0bbbbbb",
    url: "https://x/1371",
    isCrossRepository: false,
    timelineItems: { nodes: [{ createdAt: "2026-10-24T06:05:00Z" }] },
  },
  {
    number: 1400,
    headRefName: "fork/main",
    headRefOid: "1111111110cccccc",
    url: "https://x/1400",
    isCrossRepository: true,
    timelineItems: { nodes: [{ createdAt: "2026-10-24T06:10:00Z" }] },
  },
];

const fixture = (existingTitles: string[]) => {
  const pulls = structuredClone(removedPulls);
  const commands: string[][] = [];
  const workspaces: unknown[] = [];
  const sessions: Array<{ title: string; prompt: string; workspaceId: string }> = [];
  const queries: Array<{ cursor?: string; includeArchived?: boolean }> = [];
  const ctx = {
    workspaces: {
      getDefault: async () => ({ id: "default", root_path: "/repo" }),
      create: async (input: { shorthand_base: string }) => {
        workspaces.push(input);
        return { id: `ws-${input.shorthand_base}`, root_path: `/workspaces/${input.shorthand_base}` };
      },
    },
    process: {
      runOrThrow: async ({ command }: { command: string[] }) => {
        commands.push(command);
        const stdout =
          command[0] === "gh"
            ? JSON.stringify(
                [pulls.slice(0, 1), pulls.slice(1)].map((nodes) => ({
                  data: { repository: { pullRequests: { nodes } } },
                })),
              )
            : "";
        return { stdout, stderr: "", exitCode: 0 };
      },
    },
    sessions: {
      query: async (input: { cursor?: string; includeArchived?: boolean }) => {
        queries.push(input);
        const history = [...existingTitles, ...sessions.map((session) => session.title)];
        const titles = input.cursor ? history.slice(1) : history.slice(0, 1);
        return {
          items: titles.map((title, index) => ({ id: `old-${index}`, title, status: "completed" })),
          nextCursor: !input.cursor && history.length > 1 ? "older-sessions" : null,
        };
      },
      create: async (input: { title: string; prompt: string; workspaceId: string }) => {
        sessions.push(input);
        return { type: "session", id: `session-${sessions.length}`, title: input.title, status: "in_progress" };
      },
    },
  };
  return { ctx, commands, workspaces, sessions, queries, pulls };
};

test("checks every five minutes and reads all pages of removed pull requests before starting their repairs", async () => {
  const { ctx, commands, workspaces, sessions } = fixture([
    "Repair merge queue removal: #1363 at 2026-10-24T06:00:00Z",
  ]);

  const result = await command?.run(ctx as never, {});

  expect(extension.schedules?.find((schedule) => schedule.id === "merge-queue-repair")).toMatchObject({
    schedule: "*/5 * * * *",
    command: { id: "merge-queue.repair-removed", kind: "command" },
  });
  // #1363 already has a repair for this removal, and #1400 comes from a fork.
  expect(sessions.map((session) => session.title)).toEqual([
    "Repair merge queue removal: #1371 at 2026-10-24T06:05:00Z",
  ]);
  expect(commands).toContainEqual(["git", "fetch", "origin", "bugfix/stabilize"]);
  expect(workspaces).toEqual([
    { shorthand_base: "PR-1371", provider_id: "pstdio.worktree", params: { base: "origin/bugfix/stabilize" } },
  ]);
  expect(sessions[0]!.workspaceId).toBe("ws-PR-1371");
  expect(sessions[0]!.prompt).toContain("https://x/1371");
  expect(sessions[0]!.prompt).toContain("git push origin HEAD:bugfix/stabilize");
  expect(sessions[0]!.prompt).toMatch(/not caused by this pull request/i);
  expect(result).toEqual({ sessionIds: ["session-1"] });
});

test("a repair push does not start another session for the same removal", async () => {
  const { ctx, sessions, pulls } = fixture([]);

  await command?.run(ctx as never, {});
  pulls[0]!.headRefOid = "new-repair-commit";
  await command?.run(ctx as never, {});

  expect(sessions).toHaveLength(2);
});

test("a later queue removal can start a fresh repair", async () => {
  const { ctx, sessions, pulls } = fixture([
    "Repair merge queue removal: #1363 at 2026-10-24T06:00:00Z",
    "Repair merge queue removal: #1371 at 2026-10-24T06:05:00Z",
  ]);
  pulls[0]!.timelineItems.nodes[0]!.createdAt = "2026-10-24T08:00:00Z";

  await command?.run(ctx as never, {});

  expect(sessions.map((session) => session.title)).toEqual([
    "Repair merge queue removal: #1363 at 2026-10-24T08:00:00Z",
  ]);
});

test("repairs in older or archived session history are not started again", async () => {
  const { ctx, sessions, queries } = fixture([
    "Other work",
    "Repair merge queue removal: #1363 at 2026-10-24T06:00:00Z",
    "Repair merge queue removal: #1371 at 2026-10-24T06:05:00Z",
  ]);

  await command?.run(ctx as never, {});

  expect(sessions).toEqual([]);
  expect(queries).toEqual([
    { includeArchived: true, cursor: undefined },
    { includeArchived: true, cursor: "older-sessions" },
  ]);
});

test("one failed branch is reported after the other pull requests start their repairs", async () => {
  const { ctx, sessions } = fixture([]);
  const run = ctx.process.runOrThrow;
  ctx.process.runOrThrow = async (input) => {
    if (input.command[0] === "git" && input.command.at(-1) === "bugfix/windows") {
      throw new Error("Remote branch not found");
    }
    return run(input);
  };

  await expect(command?.run(ctx as never, {})).rejects.toThrow("#1363: Remote branch not found");

  expect(sessions.map((session) => session.title)).toEqual([
    "Repair merge queue removal: #1371 at 2026-10-24T06:05:00Z",
  ]);
});

for (const onlyForks of [false, true]) {
  test(`does not read session history when ${onlyForks ? "only forks" : "no pull requests"} need repairs`, async () => {
    const { ctx, pulls, queries, sessions } = fixture([]);
    pulls.splice(0, onlyForks ? 2 : pulls.length);

    const result = await command?.run(ctx as never, {});

    expect(result).toEqual({ sessionIds: [] });
    expect(queries).toEqual([]);
    expect(sessions).toEqual([]);
  });
}
