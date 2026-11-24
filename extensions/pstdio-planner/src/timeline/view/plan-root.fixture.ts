import type { GuestHost } from "@pstdio/sdk/extensions";
import { buildPlan } from "../model/build-plan";
import { timelineInitialState } from "./timeline-query";

export const backgroundFailure = "This workspace has no ready local process target.";
export const actionFailure = "Auto Build could not save its settings.";

interface Options {
  failConfigure?: boolean;
  loading?: "tickets" | "preferences";
  windowed?: boolean;
}

interface QueryInput {
  operation: string;
  command: {
    commandId: string;
    params?: { page?: { offset: number; limit: number; search: string; viewer: unknown } };
  };
}

let hostSequence = 0;

// A local host speaking the public query protocol; no project records are created by these frames.
export function createTimelineFixture(options: Options) {
  const runtimeId = `canvas-${++hostSequence}`;
  let shape: "parallel" | "chain" | "layers" = "parallel";
  let project = 1;
  let held = false;
  let revision = 0;
  const listeners = new Set<() => void>();
  const propsListeners = new Set<(props: never) => void>();
  const pending = new Set<{ resolve: () => void; reject: (error: Error) => void }>();
  const requests: Array<{ projectId: string; offset: number; viewer: unknown }> = [];
  let props = {
    projectId: `timeline-story-${project}`,
    queryScope: { runtimeId, accountId: "canvas" },
    commandQueries: { owner: `timeline-story-${project}`, values: [] },
  };
  const notify = () => {
    revision++;
    for (const listener of listeners) listener();
  };
  const plan = (page?: NonNullable<QueryInput["command"]["params"]>["page"]) => {
    const dependencyDistance = shape === "chain" ? 1 : 16;
    const tickets = Array.from({ length: options.windowed ? 300 : 0 }, (_, index) => ({
      id: `ticket-${index}`,
      shorthand: `P-${index + 1}`,
      title: `${props.projectId}: Work item ${index + 1}${shape === "chain" && index % 7 === 0 ? " with a detailed title that wraps across several lines and changes the measured height of this ticket card" : ""}`,
      content: "",
      statusId: null,
      dependsOn: shape !== "parallel" && index >= dependencyDistance ? [`ticket-${index - dependencyDistance}`] : [],
    }));
    const all = buildPlan({
      tickets,
      statuses: [],
      tags: [],
      today: "2026-10-15",
      plan: { deadlines: [], order: tickets.map(({ id }) => ({ ticketId: id, deadlineId: null })) },
    });
    const offset = page?.offset ?? 0;
    const matching = all.sections.flatMap(({ rows }) => rows).filter(({ title }) => title.includes(page?.search ?? ""));
    const rows = matching.slice(offset, offset + (page?.limit ?? 200));
    return {
      ...all,
      projectId: props.projectId,
      sections: all.sections.map((section) => ({ ...section, rows })),
      ticketRows: rows.map(({ id, title }) => ({
        id,
        title,
        attributes: {},
        resource: { type: "ticket", id, extensionId: "pstdio.planner" },
      })),
      ticketAttributes: [],
      savedViews: {
        views: [{ id: "all", boardId: "timeline", title: "All tickets", builtIn: true, ...timelineInitialState }],
        defaultViewId: "all",
      },
      page: {
        revision: "fixture",
        cursor: offset + rows.length < matching.length ? String(offset + rows.length) : null,
        total: tickets.length,
        filteredTotal: matching.length,
        groups: [],
      },
    };
  };
  const command = async (input: QueryInput["command"]) => {
    switch (input.commandId.split(".command.")[1]) {
      case "timeline.plan.schema":
        return plan();
      case "timeline.plan.read": {
        if (options.loading === "tickets") return new Promise(() => {});
        const page = input.params?.page;
        requests.push({ projectId: props.projectId, offset: page?.offset ?? 0, viewer: page?.viewer });
        const value = plan(page);
        notify();
        if (held && page?.offset) {
          await new Promise<void>((resolve, reject) => pending.add({ resolve, reject }));
        }
        notify();
        return value;
      }
      case "auto-build.read":
        return {
          enabled: false,
          prompt: "Choose small independent tickets.",
          eligible: { conjunction: "and", rules: [] },
          requireMergedDependencies: false,
          sessions: [],
          capacity: { running: 0, limit: 2 },
          error: backgroundFailure,
        };
      case "auto-build.configure":
        if (options.failConfigure) throw new Error(actionFailure);
        return {};
      default:
        throw new Error(`Unexpected command: ${input.commandId}`);
    }
  };
  const host = {
    extensionId: "pstdio.planner",
    propsStore: {
      get: () => props,
      subscribe(listener: (props: never) => void) {
        propsListeners.add(listener);
        return () => propsListeners.delete(listener);
      },
    },
    onEvent: () => () => {},
    async call(method: string, input: QueryInput) {
      if (method === "preferences.get" && options.loading === "preferences") return new Promise(() => {});
      if (method === "preferences.get" || method === "preferences.set") return undefined;
      if (method === "resources.actions") return [{ key: "inspect", label: "Inspect ticket" }];
      if (method === "commands.query") {
        if (input.operation === "close") return undefined;
        const data = await command(input.command);
        return { generation: 1, version: 1, data, stale: false, fetching: false };
      }
      if (method === "commands.execute") {
        const value = await command(input as unknown as QueryInput["command"]);
        return { outcome: { ok: true, status: "success", value } };
      }
      throw new Error(`Unexpected capability: ${method}`);
    },
  } as unknown as GuestHost;
  return {
    host,
    requests,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => revision,
    hold() {
      held = true;
    },
    release(fail = false) {
      held = false;
      for (const request of pending) {
        if (fail) request.reject(new Error("Could not load the adjacent window."));
        else request.resolve();
      }
      pending.clear();
      notify();
    },
    reset(next: typeof shape = shape) {
      shape = next;
      project++;
      props = {
        ...props,
        projectId: `timeline-story-${project}`,
        commandQueries: { owner: `timeline-story-${project}`, values: [] },
      };
      for (const listener of propsListeners) listener(props as never);
      notify();
    },
  };
}
