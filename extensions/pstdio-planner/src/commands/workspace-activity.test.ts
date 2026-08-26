import { describe, expect, test } from "bun:test";
import { createMemoryStorage } from "../data/memory-storage";
import { makeCommandArgs } from "./command-context.fixture";
import { workspaceActivityCommand } from "./workspace-activity";

const session = (id: string, status: string, overrides: Record<string, unknown> = {}) => ({
  id,
  title: `Session ${id}`,
  status,
  created_at: "2026-06-17T00:00:00.000Z",
  updated_at: "2026-06-17T01:00:00.000Z",
  ...overrides,
});

const activityContext = (sessions: unknown[]) =>
  makeCommandArgs({
    storage: createMemoryStorage(),
    params: { workspaceId: "w1" },
    overrides: {
      sessions: {
        listByWorkspace: async (workspaceId: string) => sessions.map((s) => ({ ...(s as object), workspaceId })),
      },
    } as never,
  });

describe("workspaceActivityCommand", () => {
  test.each(["queued", "in_progress", "awaiting_input"])("reports active while a session is %s", async (status) => {
    const result = await workspaceActivityCommand.run(
      ...activityContext([session("s1", "completed"), session("s2", status)]),
    );

    expect(result.active).toBe(true);
  });

  test.each([
    "completed",
    "failed",
    "cancelled",
    "disconnected",
  ])("reports inactive when every session is terminal (%s)", async (status) => {
    const result = await workspaceActivityCommand.run(...activityContext([session("s1", status)]));

    expect(result.active).toBe(false);
    expect(result.sessions.map((entry) => entry.status)).toEqual([status]);
  });

  test("returns the session list with timestamps", async () => {
    const result = await workspaceActivityCommand.run(...activityContext([session("s1", "completed")]));

    expect(result).toEqual({
      active: false,
      sessions: [
        {
          id: "s1",
          title: "Session s1",
          status: "completed",
          anchors: [],
          phase: "other",
          createdAt: "2026-06-17T00:00:00.000Z",
          updatedAt: "2026-06-17T01:00:00.000Z",
        },
      ],
    });
  });

  test("preserves session anchors and derives the attempt phase", async () => {
    const anchors = [
      { type: "planner-attempt", id: "w1", metadata: { phase: "implementation" } },
      { type: "ticket", id: "ticket-1" },
    ];

    const result = await workspaceActivityCommand.run(
      ...activityContext([session("s1", "in_progress", { anchors_json: anchors })]),
    );

    expect(result.sessions[0]).toMatchObject({ anchors, phase: "implementation" });
  });

  test("reports inactive for a workspace without sessions", async () => {
    const result = await workspaceActivityCommand.run(...activityContext([]));

    expect(result).toEqual({ active: false, sessions: [] });
  });
});
