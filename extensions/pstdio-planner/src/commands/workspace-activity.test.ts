import { describe, expect, test } from "bun:test";
import type { CommandContext, ExtensionSessionSummary } from "@pstdio/sdk/extensions";
import { createMemoryStorage } from "../data/memory-storage";
import { makeCommandContext } from "./command-context.fixture";
import { workspaceActivityCommand } from "./workspace-activity";

type ActivityParams = { workspaceId: string };

const makeSession = (overrides: Partial<ExtensionSessionSummary> = {}): ExtensionSessionSummary => ({
  id: "session-1",
  title: "Session",
  status: "in_progress",
  archived: false,
  original_session_id: null,
  cwd: "/repo",
  anchors_json: [],
  created_at: "2026-06-24T09:00:00.000Z",
  updated_at: "2026-06-24T09:30:00.000Z",
  ...overrides,
});

const runCommand = (sessions: ExtensionSessionSummary[]) => {
  const listCalls: Array<{ workspaceId: string }> = [];
  const ctx = makeCommandContext<ActivityParams>({
    storage: createMemoryStorage(),
    params: { workspaceId: "ws-1" },
    overrides: {
      sessions: {
        list: async (input: { workspaceId: string }) => {
          listCalls.push(input);
          return sessions;
        },
      },
    },
  });
  return { run: () => workspaceActivityCommand.run(ctx as unknown as CommandContext<ActivityParams>), listCalls };
};

describe("workspace-activity", () => {
  test("reports active=true when any session is in a live status", async () => {
    const { run } = runCommand([
      makeSession({ id: "queued-1", status: "queued" }),
      makeSession({ id: "completed-1", status: "completed" }),
    ]);

    const result = await run();

    expect(result).toMatchObject({ active: true });
    expect(result.sessions.map((session) => session.id)).toEqual(["queued-1", "completed-1"]);
  });

  test("treats awaiting_input and in_progress as live statuses", async () => {
    const { run } = runCommand([
      makeSession({ id: "in-progress", status: "in_progress" }),
      makeSession({ id: "awaiting", status: "awaiting_input" }),
    ]);

    const result = await run();

    expect(result.active).toBe(true);
  });

  test("returns active=false when every session is in a terminal status", async () => {
    const { run } = runCommand([
      makeSession({ id: "done", status: "completed" }),
      makeSession({ id: "failed-1", status: "failed" }),
      makeSession({ id: "cancelled-1", status: "cancelled" }),
      makeSession({ id: "disconnected-1", status: "disconnected" }),
    ]);

    const result = await run();

    expect(result.active).toBe(false);
  });

  test("keeps disconnected sessions visible so stuck-work logic can act on them", async () => {
    const { run } = runCommand([makeSession({ id: "disconnected-1", status: "disconnected" })]);

    const result = await run();

    expect(result.active).toBe(false);
    expect(result.sessions).toEqual([
      {
        id: "disconnected-1",
        title: "Session",
        status: "disconnected",
        createdAt: "2026-06-24T09:00:00.000Z",
        updatedAt: "2026-06-24T09:30:00.000Z",
      },
    ]);
  });

  test("hides archived sessions from the activity probe", async () => {
    const { run } = runCommand([
      makeSession({ id: "visible", status: "in_progress" }),
      makeSession({ id: "archived-live", status: "in_progress", archived: true }),
    ]);

    const result = await run();

    expect(result.sessions.map((session) => session.id)).toEqual(["visible"]);
    expect(result.active).toBe(true);
  });

  test("forwards the workspaceId to the sessions API", async () => {
    const { run, listCalls } = runCommand([]);

    await run();

    expect(listCalls).toEqual([{ workspaceId: "ws-1" }]);
  });

  test("returns active=false with no sessions", async () => {
    const { run } = runCommand([]);

    const result = await run();

    expect(result).toEqual({ active: false, sessions: [] });
  });
});
