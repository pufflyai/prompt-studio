import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import type { AutomationContext } from "./automation-run";
import type { PlannerStatus, PlannerTag, PlannerTicket, TicketWorkspaceRow, WorkspaceActivity } from "./planner-client";

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
    name: "human_requested",
    sortOrder: 3,
    options: [{ id: "human-requested-true", name: "True", sortOrder: 0 }],
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
}

// A stand-in for the planner's public command surface: the same command ids the
// automations call, backed by in-memory ticket state so durable updates are observable.
export const makeAutomationContext = (state: PlannerFixtureState) => {
  const calls: Array<{ commandId: string; params: Record<string, unknown> }> = [];
  const activities: Array<{ message: string; metadata?: Record<string, unknown> }> = [];
  const statuses = state.statuses ?? DEFAULT_STATUSES;
  const tags = state.tags ?? DEFAULT_TAGS;
  let createdSessions = 0;

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

  const run = (commandId: string, params: Record<string, unknown>): unknown => {
    switch (commandId) {
      case "pstdio-planner.automation-policy":
        return { maxInProgress: state.maxInProgress ?? 2 };
      case "pstdio-planner.read-tickets":
        return state.tickets;
      case "pstdio-planner.ticketStatus.read":
        return { statuses };
      case "pstdio-planner.ticketTag.read":
        return { tags };
      case "pstdio-planner.get-ticket":
        return findTicket(params.id as string);
      case "pstdio-planner.set-ticket-attribute":
        return setAttribute(params as { rowId: string; attributeId: string; value: string });
      case "pstdio-planner.refine-ticket":
        return { id: `refine-session-${++createdSessions}` };
      case "pstdio-planner.run-attempt": {
        const ticket = findTicket(params.ticket as string);
        if (ticket) ticket.statusId = "in-progress";
        return { session: { id: `implement-session-${++createdSessions}` } };
      }
      case "pstdio-planner.runReview":
        return { id: `review-session-${++createdSessions}` };
      case "pstdio-planner.ticket-workspaces": {
        const ticket = findTicket(params.id as string);
        return state.workspacesByTicket?.[ticket?.shorthand ?? ""] ?? [];
      }
      case "pstdio-planner.workspace-activity":
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
      execute: async (ref: { id: string } | string, invocation: { params?: Record<string, unknown> }) => {
        const commandId = typeof ref === "string" ? ref : ref.id;
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
