import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import type { AutomationContext } from "./automation-run";
import type {
  PlannerAttempt,
  PlannerStatus,
  PlannerTag,
  PlannerTicket,
  TicketWorkspaceRow,
  WorkspaceActivity,
} from "./planner-client";

export const DEFAULT_STATUSES: PlannerStatus[] = [
  { id: "backlog", name: "Backlog", sortOrder: 0 },
  { id: "ready", name: "TODO", sortOrder: 1 },
  { id: "in-progress", name: "In Progress", sortOrder: 2 },
  { id: "blocked", name: "Blocked", sortOrder: 3 },
  { id: "in-review", name: "In Review", sortOrder: 4 },
  { id: "done", name: "Done", sortOrder: 5 },
];

export const DEFAULT_TAGS: PlannerTag[] = [
  {
    id: "default-priority",
    name: "Priority",
    sortOrder: 0,
    options: [
      { id: "priority-low", name: "Low", sortOrder: 0 },
      { id: "priority-medium", name: "Medium", sortOrder: 1 },
      { id: "priority-high", name: "High", sortOrder: 2 },
      { id: "priority-urgent", name: "Urgent", sortOrder: 3 },
    ],
  },
  {
    id: "default-human-requested",
    name: "Flags",
    sortOrder: 3,
    options: [{ id: "default-human-requested-true", name: "Human Requested", sortOrder: 0 }],
  },
];

export const makeTicket = (overrides: Partial<PlannerTicket> & { id: string }): PlannerTicket => ({
  shorthand: overrides.id.toUpperCase(),
  title: `Ticket ${overrides.id}`,
  statusId: "backlog",
  tagIds: [],
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
  ...overrides,
});

export const makeAttempt = (
  overrides: Partial<PlannerAttempt> & { workspaceId: string; ticketId: string },
): PlannerAttempt => ({
  workspaceShorthand: `${overrides.ticketId}_A1`,
  ticketShorthand: overrides.ticketId.toUpperCase(),
  implementationSessionId: `implementation-${overrides.workspaceId}`,
  state: "implementing",
  revisions: [],
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
  ...overrides,
});

export const createMemoryStorage = () => {
  const kv = new Map<string, unknown>();
  const collections = new Map<string, Map<string, unknown>>();

  return {
    get: async (key: string) => kv.get(key) ?? null,
    set: async (key: string, value: unknown) => {
      kv.set(key, value);
    },
    delete: async (key: string) => {
      kv.delete(key);
    },
    collection: (name: string) => {
      const items = collections.get(name) ?? new Map<string, unknown>();
      collections.set(name, items);
      return {
        list: async () => [...items.values()],
        get: async (id: string) => items.get(id) ?? null,
        put: async (id: string, value: unknown) => {
          items.set(id, value);
        },
        delete: async (id: string) => {
          items.delete(id);
        },
      };
    },
  } as unknown as ExtensionStorageApi;
};

export interface PlannerFixtureState {
  tickets: PlannerTicket[];
  statuses?: PlannerStatus[];
  tags?: PlannerTag[];
  workspacesByTicket?: Record<string, TicketWorkspaceRow[]>;
  activityByWorkspace?: Record<string, WorkspaceActivity>;
  sessionsById?: Record<string, { id: string; status: string }>;
  maxInProgress?: number;
  attempts?: PlannerAttempt[];
  reconcileDecisions?: Record<string, string>;
}

// A stand-in for the planner's public command surface: the same command ids the
// automations call, backed by in-memory ticket state so durable updates are observable.
export const makeAutomationContext = (state: PlannerFixtureState) => {
  const calls: Array<{ commandId: string; params: Record<string, unknown> }> = [];
  const activities: Array<{ message: string; metadata?: Record<string, unknown> }> = [];
  const statuses = state.statuses ?? DEFAULT_STATUSES;
  const tags = state.tags ?? DEFAULT_TAGS;
  let createdSessions = 0;
  const attempts = state.attempts ?? [];

  const findTicket = (ref: string) =>
    state.tickets.find((ticket) => ticket.id === ref || ticket.shorthand === ref) ?? null;

  const setAttribute = (params: { rowId: string; attributeId: string; value: string }) => {
    const ticket = findTicket(params.rowId);
    if (!ticket) return null;
    if (params.attributeId === "status") {
      ticket.statusId = params.value;
    } else {
      const tag = tags.find((candidate) => candidate.id === params.attributeId);
      const optionIds = new Set((tag?.options ?? []).map((option) => option.id));
      ticket.tagIds = [...(ticket.tagIds ?? []).filter((id) => !optionIds.has(id)), params.value];
    }
    ticket.updatedAt = new Date().toISOString();
    return ticket;
  };

  const runAttempt = (params: Record<string, unknown>) => {
    const ticket = findTicket(params.ticket as string);
    const active = attempts.filter(
      (attempt) => attempt.state === "implementing" || attempt.state === "changes_requested",
    );
    if (active.length >= (state.maxInProgress ?? 2)) {
      return { decision: "wait", reason: "capacity-full", dependencyIds: [] };
    }
    if (ticket) ticket.statusId = "in-progress";
    const sessionId = `implement-session-${++createdSessions}`;
    const attempt: PlannerAttempt = {
      workspaceId: `workspace-${ticket?.id ?? createdSessions}`,
      workspaceShorthand: `${ticket?.shorthand ?? params.ticket}_A1`,
      ticketId: ticket?.id ?? String(params.ticket),
      ticketShorthand: ticket?.shorthand ?? String(params.ticket),
      implementationSessionId: sessionId,
      state: "implementing",
      revisions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    attempts.push(attempt);
    return { decision: "started", session: { id: sessionId }, attempt };
  };

  const runReview = (params: Record<string, unknown>) => {
    const attempt = attempts.find((candidate) => candidate.workspaceId === params.workspaceId);
    if (attempt) attempt.state = "reviewing";
    return {
      review: { id: `review-${++createdSessions}` },
      session: { id: `review-session-${createdSessions}` },
    };
  };

  const reconcileAttempt = (params: Record<string, unknown>) => {
    const attempt = attempts.find((candidate) => candidate.workspaceId === params.workspaceId);
    if (!attempt) throw new Error(`Unknown attempt: ${params.workspaceId}`);
    return { decision: state.reconcileDecisions?.[attempt.workspaceId] ?? "active", attempt };
  };

  const run = (commandId: string, params: Record<string, unknown>): unknown => {
    switch (commandId) {
      case "pstdio.pstdio-planner.command.automation-policy":
        return { maxInProgress: state.maxInProgress ?? 2 };
      case "pstdio.pstdio-planner.command.read-tickets":
        return state.tickets;
      case "pstdio.pstdio-planner.command.ticket-status.read":
        return { statuses };
      case "pstdio.pstdio-planner.command.ticket-tag.read":
        return { tags };
      case "pstdio.pstdio-planner.command.get-ticket":
        return findTicket(params.id as string);
      case "pstdio.pstdio-planner.command.set-ticket-attribute":
        return setAttribute(params as { rowId: string; attributeId: string; value: string });
      case "pstdio.pstdio-planner.command.refine-ticket":
        return { id: `refine-session-${++createdSessions}` };
      case "pstdio.pstdio-planner.command.run-attempt":
        return runAttempt(params);
      case "pstdio.pstdio-planner.command.run-review":
        return runReview(params);
      case "pstdio.pstdio-planner.command.list-attempts":
        return attempts;
      case "pstdio.pstdio-planner.command.reconcile-attempt":
        return reconcileAttempt(params);
      case "pstdio.pstdio-planner.command.ticket-workspaces": {
        const ticket = findTicket(params.id as string);
        return state.workspacesByTicket?.[ticket?.shorthand ?? ""] ?? [];
      }
      case "pstdio.pstdio-planner.command.workspace-activity":
        return state.activityByWorkspace?.[params.workspaceId as string] ?? { active: false, sessions: [] };
      default:
        throw new Error(`Unexpected planner command: ${commandId}`);
    }
  };

  const ctx = {
    storage: createMemoryStorage(),
    activity: {
      record: async (input: { message: string; metadata?: Record<string, unknown> }) => {
        activities.push(input);
        return { id: `activity-${activities.length}` };
      },
    },
    sessions: { get: async (id: string) => state.sessionsById?.[id] ?? null },
    commands: {
      execute: async (
        ref: { extensionId?: string; id: string } | string,
        invocation: { params?: Record<string, unknown> },
      ) => {
        const commandId =
          typeof ref === "string" ? ref : ref.extensionId ? `${ref.extensionId}.command.${ref.id}` : ref.id;
        const params = invocation.params ?? {};
        calls.push({ commandId, params });
        return { ok: true, status: "success", value: run(commandId, params) };
      },
    },
  } as unknown as AutomationContext;

  return { ctx, calls, activities };
};

export const callsTo = (calls: Array<{ commandId: string; params: Record<string, unknown> }>, commandId: string) =>
  calls.filter((call) => call.commandId === commandId);
