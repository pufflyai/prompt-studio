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
  },
  {
    number: 1371,
    headRefName: "bugfix/stabilize",
    headRefOid: "787e8ec0f0bbbbbb",
    url: "https://x/1371",
    isCrossRepository: false,
  },
  {
    number: 1400,
    headRefName: "fork/main",
    headRefOid: "1111111110cccccc",
    url: "https://x/1400",
    isCrossRepository: true,
  },
];

const fixture = (existingTitles: string[]) => {
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
        return { stdout: command[0] === "gh" ? JSON.stringify(removedPulls) : "", stderr: "", exitCode: 0 };
      },
    },
    sessions: {
      query: async (input: { cursor?: string; includeArchived?: boolean }) => {
        queries.push(input);
        const titles = input.cursor ? existingTitles.slice(1) : existingTitles.slice(0, 1);
        return {
          items: titles.map((title, index) => ({ id: `old-${index}`, title, status: "completed" })),
          nextCursor: !input.cursor && existingTitles.length > 1 ? "older-sessions" : null,
        };
      },
      create: async (input: { title: string; prompt: string; workspaceId: string }) => {
        sessions.push(input);
        return { type: "session", id: `session-${sessions.length}`, title: input.title, status: "in_progress" };
      },
    },
  };
  return { ctx, commands, workspaces, sessions, queries };
};

test("checks every five minutes and starts one repair session per removed pull request on its own branch", async () => {
  const { ctx, commands, workspaces, sessions } = fixture(["Repair merge queue removal: #1363 at 57c985327"]);

  const result = await command?.run(ctx as never, {});

  expect(extension.schedules?.find((schedule) => schedule.id === "merge-queue-repair")).toMatchObject({
    schedule: "*/5 * * * *",
    command: { id: "merge-queue.repair-removed", kind: "command" },
  });
  // #1363 already has a session for this head commit, and #1400 comes from a fork.
  expect(sessions.map((session) => session.title)).toEqual(["Repair merge queue removal: #1371 at 787e8ec0f"]);
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

test("a new head commit after a failed repair gets a new session", async () => {
  const { ctx, sessions } = fixture([
    "Repair merge queue removal: #1363 at 0000000aa",
    "Repair merge queue removal: #1371 at 787e8ec0f",
  ]);

  await command?.run(ctx as never, {});

  expect(sessions.map((session) => session.title)).toEqual(["Repair merge queue removal: #1363 at 57c985327"]);
});

test("repairs in older or archived session history are not started again", async () => {
  const { ctx, sessions, queries } = fixture([
    "Other work",
    "Repair merge queue removal: #1363 at 57c985327",
    "Repair merge queue removal: #1371 at 787e8ec0f",
  ]);

  await command?.run(ctx as never, {});

  expect(sessions).toEqual([]);
  expect(queries).toEqual([
    { includeArchived: true, cursor: undefined },
    { includeArchived: true, cursor: "older-sessions" },
  ]);
});
