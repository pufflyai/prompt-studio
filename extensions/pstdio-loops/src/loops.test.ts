import { describe, expect, test } from "bun:test";
import type { CommandContext, CommandOutcome } from "@pstdio/sdk/extensions";
import { implementationTickRun, refinementSweepRun, reviewTickRun, stuckWorkSweepRun } from "./loops";
import {
  implementTicketRef,
  type PlannerStatus,
  type PlannerTag,
  type PlannerTicket,
  refineTicketRef,
  runReviewRef,
  setTicketAttributeRef,
} from "./planner-commands";

const ok = <T>(value: T): CommandOutcome<T> => ({ ok: true, status: "success", value });

const STATUSES: PlannerStatus[] = [
  { id: "default-backlog", name: "Backlog", sortOrder: 0 },
  { id: "default-refine", name: "Refine", sortOrder: 1 },
  { id: "default-ready", name: "Ready", sortOrder: 2 },
  { id: "default-in-progress", name: "In Progress", sortOrder: 3 },
  { id: "default-blocked", name: "Blocked", sortOrder: 4 },
  { id: "default-in-review", name: "In Review", sortOrder: 5 },
];

const TAGS: PlannerTag[] = [
  {
    id: "default-priority",
    name: "Priority",
    sortOrder: 0,
    options: [
      { id: "default-priority-low", name: "Low", sortOrder: 0 },
      { id: "default-priority-medium", name: "Medium", sortOrder: 1 },
      { id: "default-priority-high", name: "High", sortOrder: 2 },
      { id: "default-priority-urgent", name: "Urgent", sortOrder: 3 },
    ],
  },
  {
    id: "default-human-requested",
    name: "human_requested",
    sortOrder: 3,
    options: [{ id: "default-human-requested-true", name: "True", sortOrder: 0 }],
  },
];

const HUMAN_REQUESTED = "default-human-requested-true";

const ticket = (overrides: Partial<PlannerTicket> = {}): PlannerTicket => ({
  id: overrides.id ?? "ticket-1",
  shorthand: overrides.shorthand ?? "T-1",
  statusId: overrides.statusId ?? "default-backlog",
  tagIds: overrides.tagIds ?? [],
  createdAt: overrides.createdAt ?? "2026-06-24T08:00:00.000Z",
  updatedAt: overrides.updatedAt ?? "2026-06-24T08:00:00.000Z",
});

interface MockWorld {
  tickets: PlannerTicket[];
  statusIds?: Partial<{
    refine: string;
    ready: string;
    inProgress: string;
    blocked: string;
    inReview: string;
  }>;
  workspaces?: Array<{
    id: string;
    project_id?: string;
    anchors_json?: Array<{ type: string; id: string; metadata?: Record<string, unknown> }>;
  }>;
  activities?: Record<
    string,
    {
      active: boolean;
      sessions: Array<{ id: string; title: string; status: string; createdAt: string; updatedAt: string }>;
    }
  >;
  enabled?: boolean;
  maxInProgress?: number;
}

const buildCtx = (world: MockWorld) => {
  const calls: Array<{ command: string; params: Record<string, unknown> }> = [];
  const activityLog: Array<{ message: string; metadata?: Record<string, unknown> }> = [];
  const ticketsById = new Map(world.tickets.map((t) => [t.id, { ...t }]));

  const executeMap: Record<string, (params: Record<string, unknown>) => CommandOutcome<unknown>> = {
    "pstdio-planner.read-tickets": () => ok([...ticketsById.values()]),
    "pstdio-planner.ticketStatus.read": () => ok({ statuses: STATUSES }),
    "pstdio-planner.ticketTag.read": () => ok({ tags: TAGS }),
    "pstdio-planner.workspace-activity": (params) =>
      ok(world.activities?.[params.workspaceId as string] ?? { active: false, sessions: [] }),
    "pstdio-planner.set-ticket-attribute": (params) => {
      const row = ticketsById.get(params.rowId as string);
      if (!row) return ok(null);
      if (params.attributeId === "status") {
        row.statusId = params.value as string;
      } else if (typeof params.attributeId === "string") {
        // tag-option attribute id: append the option to tagIds
        const optionId = String(params.value);
        if (!row.tagIds?.includes(optionId)) row.tagIds = [...(row.tagIds ?? []), optionId];
      }
      ticketsById.set(row.id, row);
      return ok(row);
    },
    "pstdio-planner.refine-ticket": () => ok(undefined),
    "pstdio-planner.implement-ticket": () => ok(undefined),
    "pstdio-planner.runReview": () => ok(undefined),
  };

  const commands = {
    execute: async (commandOrRef: unknown, invocation: { params?: Record<string, unknown> }) => {
      const id = typeof commandOrRef === "string" ? commandOrRef : (commandOrRef as { id: string }).id;
      const params = invocation.params ?? {};
      calls.push({ command: id, params });
      const handler = executeMap[id];
      return handler ? handler(params) : ok(null);
    },
  };

  const settings = {
    get: async (key: string) => {
      if (key === "automations.enabled") return world.enabled ?? true;
      if (key === "automations.maxInProgress") return world.maxInProgress ?? 5;
      if (key === "automations.status.refine") return world.statusIds?.refine ?? "default-refine";
      if (key === "automations.status.ready") return world.statusIds?.ready ?? "default-ready";
      if (key === "automations.status.inProgress") return world.statusIds?.inProgress ?? "default-in-progress";
      if (key === "automations.status.blocked") return world.statusIds?.blocked ?? "default-blocked";
      if (key === "automations.status.inReview") return world.statusIds?.inReview ?? "default-in-review";
      return undefined;
    },
  };

  const activity = {
    record: async (input: { message: string; metadata?: Record<string, unknown> }) => {
      activityLog.push({ message: input.message, metadata: input.metadata });
      return { id: `activity-${activityLog.length}` };
    },
  };

  const workspaces = {
    list: async () => world.workspaces ?? [],
  };

  const ctx = {
    commands,
    settings,
    activity,
    workspaces,
    projectId: "project-1",
  } as unknown as CommandContext;

  return { ctx, calls, activityLog, ticketsById };
};

const callsTo = (calls: Array<{ command: string; params: Record<string, unknown> }>, id: string) =>
  calls.filter((call) => call.command === id);

describe("refinementSweepRun", () => {
  test("skips when automations are disabled", async () => {
    const { ctx, calls, activityLog } = buildCtx({
      tickets: [ticket({ statusId: "default-refine" })],
      enabled: false,
    });
    const result = await refinementSweepRun(ctx);
    expect(result.picked).toBe(0);
    expect(callsTo(calls, refineTicketRef.id)).toHaveLength(0);
    expect(activityLog[0].message).toMatch(/disabled/);
  });

  test("picks the oldest Refine ticket without human_requested, then tags it", async () => {
    const { ctx, calls, ticketsById } = buildCtx({
      tickets: [
        ticket({ id: "older", shorthand: "T-1", statusId: "default-refine", updatedAt: "2026-06-20T00:00:00.000Z" }),
        ticket({ id: "newer", shorthand: "T-2", statusId: "default-refine", updatedAt: "2026-06-22T00:00:00.000Z" }),
        ticket({ id: "tagged", shorthand: "T-3", statusId: "default-refine", tagIds: [HUMAN_REQUESTED] }),
      ],
    });
    const result = await refinementSweepRun(ctx);
    expect(result).toMatchObject({ picked: 1, ticket: "T-1", refined: true });

    const refineCalls = callsTo(calls, refineTicketRef.id);
    expect(refineCalls).toEqual([{ command: refineTicketRef.id, params: { ticket: "T-1" } }]);

    expect(ticketsById.get("older")!.statusId).toBe("default-ready");
    expect(ticketsById.get("older")!.tagIds).toContain(HUMAN_REQUESTED);
  });

  test("uses configured status ids instead of planner status names", async () => {
    const { ctx, calls, ticketsById } = buildCtx({
      statusIds: { refine: "custom-refine", ready: "custom-ready" },
      tickets: [ticket({ id: "custom", shorthand: "T-9", statusId: "custom-refine" })],
    });
    const result = await refinementSweepRun(ctx);
    expect(result).toMatchObject({ picked: 1, ticket: "T-9", refined: true });
    expect(callsTo(calls, refineTicketRef.id)).toEqual([{ command: refineTicketRef.id, params: { ticket: "T-9" } }]);
    expect(ticketsById.get("custom")!.statusId).toBe("custom-ready");
  });

  test("records an error and leaves the ticket in Refine when refinement throws", async () => {
    const { ctx, activityLog, ticketsById } = buildCtx({
      tickets: [ticket({ statusId: "default-refine" })],
    });
    // Swap the refine handler with one that throws.
    const originalExecute = ctx.commands.execute;
    (ctx.commands as { execute: typeof originalExecute }).execute = async (commandOrRef, invocation) => {
      const id = typeof commandOrRef === "string" ? commandOrRef : (commandOrRef as { id: string }).id;
      if (id === refineTicketRef.id) throw new Error("boom");
      return originalExecute(commandOrRef, invocation);
    };
    const result = await refinementSweepRun(ctx);
    expect(result.refined).toBe(false);
    expect(ticketsById.get("ticket-1")!.statusId).toBe("default-refine");
    expect(activityLog.some((entry) => entry.message.includes("Refinement failed"))).toBe(true);
  });
});

describe("implementationTickRun", () => {
  test("respects the maxInProgress cap", async () => {
    const { ctx, calls } = buildCtx({
      tickets: [
        ticket({ id: "ready-1", statusId: "default-ready" }),
        ticket({ id: "ready-2", statusId: "default-ready" }),
        ticket({ id: "ip-1", statusId: "default-in-progress" }),
        ticket({ id: "ip-2", statusId: "default-in-progress" }),
        ticket({ id: "ip-3", statusId: "default-in-progress" }),
      ],
      maxInProgress: 3,
    });
    const result = await implementationTickRun(ctx);
    expect(result.picked).toBe(0);
    expect(callsTo(calls, implementTicketRef.id)).toHaveLength(0);
  });

  test("orders by priority then createdAt, and ignores human_requested tickets", async () => {
    const { ctx, calls } = buildCtx({
      tickets: [
        ticket({
          id: "low",
          shorthand: "T-1",
          statusId: "default-ready",
          tagIds: ["default-priority-low"],
          createdAt: "2026-01-01T00:00:00.000Z",
        }),
        ticket({
          id: "urgent",
          shorthand: "T-2",
          statusId: "default-ready",
          tagIds: ["default-priority-urgent"],
          createdAt: "2026-01-02T00:00:00.000Z",
        }),
        ticket({
          id: "tagged",
          shorthand: "T-3",
          statusId: "default-ready",
          tagIds: ["default-priority-urgent", HUMAN_REQUESTED],
        }),
      ],
      maxInProgress: 10,
    });
    await implementationTickRun(ctx);
    const implementCalls = callsTo(calls, implementTicketRef.id);
    expect(implementCalls.map((call) => call.params.ticket)).toEqual(["T-2", "T-1"]);
  });

  test("uses configured ready and in-progress ids", async () => {
    const { ctx, calls } = buildCtx({
      statusIds: { ready: "custom-ready", inProgress: "custom-active" },
      tickets: [
        ticket({ id: "ready", shorthand: "T-1", statusId: "custom-ready" }),
        ticket({ id: "active", shorthand: "T-2", statusId: "custom-active" }),
      ],
      maxInProgress: 2,
    });
    await implementationTickRun(ctx);
    expect(callsTo(calls, implementTicketRef.id).map((call) => call.params.ticket)).toEqual(["T-1"]);
  });
});

describe("stuckWorkSweepRun", () => {
  const old = "2026-06-20T00:00:00.000Z";

  test("moves to In Review when the latest session completed", async () => {
    const { ctx, ticketsById } = buildCtx({
      statusIds: { inProgress: "custom-active", inReview: "custom-review" },
      tickets: [ticket({ id: "ticket-1", statusId: "custom-active", updatedAt: old })],
      workspaces: [
        {
          id: "ws-1",
          project_id: "project-1",
          anchors_json: [{ type: "ticket", id: "ticket-1", metadata: { shorthand: "T-1" } }],
        },
      ],
      activities: {
        "ws-1": {
          active: false,
          sessions: [
            {
              id: "s1",
              title: "Implement",
              status: "completed",
              createdAt: old,
              updatedAt: "2026-06-21T00:00:00.000Z",
            },
          ],
        },
      },
    });
    await stuckWorkSweepRun(ctx);
    expect(ticketsById.get("ticket-1")!.statusId).toBe("custom-review");
  });

  test("moves to Blocked when the latest session failed", async () => {
    const { ctx, ticketsById } = buildCtx({
      statusIds: { inProgress: "custom-active", blocked: "custom-blocked" },
      tickets: [ticket({ id: "ticket-1", statusId: "custom-active", updatedAt: old })],
      workspaces: [
        {
          id: "ws-1",
          project_id: "project-1",
          anchors_json: [{ type: "ticket", id: "ticket-1", metadata: { shorthand: "T-1" } }],
        },
      ],
      activities: {
        "ws-1": {
          active: false,
          sessions: [
            { id: "s1", title: "Implement", status: "failed", createdAt: old, updatedAt: "2026-06-21T00:00:00.000Z" },
          ],
        },
      },
    });
    await stuckWorkSweepRun(ctx);
    expect(ticketsById.get("ticket-1")!.statusId).toBe("custom-blocked");
  });

  test("leaves the ticket alone when any workspace is still active", async () => {
    const { ctx, ticketsById } = buildCtx({
      tickets: [ticket({ id: "ticket-1", statusId: "default-in-progress", updatedAt: old })],
      workspaces: [
        {
          id: "ws-1",
          project_id: "project-1",
          anchors_json: [{ type: "ticket", id: "ticket-1", metadata: { shorthand: "T-1" } }],
        },
      ],
      activities: {
        "ws-1": {
          active: true,
          sessions: [{ id: "s1", title: "Implement", status: "in_progress", createdAt: old, updatedAt: old }],
        },
      },
    });
    await stuckWorkSweepRun(ctx);
    expect(ticketsById.get("ticket-1")!.statusId).toBe("default-in-progress");
  });
});

describe("reviewTickRun", () => {
  test("invokes runReview and tags human_requested on success", async () => {
    const { ctx, calls, ticketsById } = buildCtx({
      statusIds: { inReview: "custom-review" },
      tickets: [ticket({ id: "ticket-1", shorthand: "T-1", statusId: "custom-review" })],
      workspaces: [
        {
          id: "ws-1",
          project_id: "project-1",
          anchors_json: [{ type: "ticket", id: "ticket-1", metadata: { shorthand: "T-1" } }],
        },
      ],
      activities: { "ws-1": { active: false, sessions: [] } },
    });
    const result = await reviewTickRun(ctx);
    expect(result).toMatchObject({ picked: 1, outcome: "review-run" });
    expect(callsTo(calls, runReviewRef.id)).toHaveLength(1);
    expect(ticketsById.get("ticket-1")!.tagIds).toContain(HUMAN_REQUESTED);
  });

  test("moves back to In Progress when runReview throws", async () => {
    const { ctx, ticketsById } = buildCtx({
      statusIds: { inReview: "custom-review", inProgress: "custom-active" },
      tickets: [ticket({ id: "ticket-1", shorthand: "T-1", statusId: "custom-review" })],
      workspaces: [
        {
          id: "ws-1",
          project_id: "project-1",
          anchors_json: [{ type: "ticket", id: "ticket-1", metadata: { shorthand: "T-1" } }],
        },
      ],
      activities: { "ws-1": { active: false, sessions: [] } },
    });
    const originalExecute = ctx.commands.execute;
    (ctx.commands as { execute: typeof originalExecute }).execute = async (commandOrRef, invocation) => {
      const id = typeof commandOrRef === "string" ? commandOrRef : (commandOrRef as { id: string }).id;
      if (id === runReviewRef.id) throw new Error("review-failed");
      return originalExecute(commandOrRef, invocation);
    };
    const result = await reviewTickRun(ctx);
    expect(result).toMatchObject({ outcome: "review-failed" });
    expect(ticketsById.get("ticket-1")!.statusId).toBe("custom-active");
  });

  test("skips when any workspace is still active", async () => {
    const { ctx, calls } = buildCtx({
      tickets: [ticket({ id: "ticket-1", shorthand: "T-1", statusId: "default-in-review" })],
      workspaces: [
        {
          id: "ws-1",
          project_id: "project-1",
          anchors_json: [{ type: "ticket", id: "ticket-1", metadata: { shorthand: "T-1" } }],
        },
      ],
      activities: {
        "ws-1": {
          active: true,
          sessions: [{ id: "s", title: "", status: "in_progress", createdAt: "", updatedAt: "" }],
        },
      },
    });
    const result = await reviewTickRun(ctx);
    expect(result.picked).toBe(0);
    expect(callsTo(calls, runReviewRef.id)).toHaveLength(0);
  });
});

describe("setTicketAttributeRef shape", () => {
  test("matches the planner's published command id", () => {
    expect(setTicketAttributeRef.id).toBe("pstdio-planner.set-ticket-attribute");
  });
});
