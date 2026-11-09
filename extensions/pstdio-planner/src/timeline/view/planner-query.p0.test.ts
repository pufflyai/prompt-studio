import { expect, test } from "bun:test";
import { createWebviewClient, type EventRef, type GuestHost, getCommandValue } from "@pstdio/sdk/extensions";
import { publishRequestChange } from "../../data/review-request-service";
import { plannerTicketsChanged } from "../../events";
import { createPlannerQuery, updatePlannerQuery } from "./planner-query";

const turn = () => new Promise<void>((resolve) => setImmediate(resolve));
const fixture = () => {
  const listeners = new Set<(event: unknown) => void>();
  const calls = new Map<string, number>();
  const waiting = new Map<string, Promise<unknown>>();
  let failed = false;
  let value = { projectId: "project", enabled: false, sessions: ["current"] };
  const host = {
    extensionId: "pstdio.pstdio-planner",
    propsStore: { get: () => ({ projectId: "project" }), subscribe: () => () => {} },
    onEvent: (_scope: string, listener: (event: unknown) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    call: async (_method: string, input: { commandId: string }) => {
      calls.set(input.commandId, (calls.get(input.commandId) ?? 0) + 1);
      if (failed) throw new Error("Planner is unavailable");
      return {
        outcome: {
          ok: true,
          status: "success",
          value: waiting.get(input.commandId) ? await waiting.get(input.commandId) : structuredClone(value),
        },
      };
    },
  } as unknown as GuestHost;
  const client = createWebviewClient(host);
  const read = async () =>
    getCommandValue((await host.call("commands.execute", { commandId: "plan", params: {} })).outcome);
  const query = (id: string, events: readonly EventRef[] = [plannerTicketsChanged], resourceId?: string) =>
    createPlannerQuery(client, id, read, events, resourceId);
  return {
    client,
    calls,
    query,
    waiting,
    listeners,
    setFailed: (next: boolean) => {
      failed = next;
    },
    setValue: (next: typeof value) => {
      value = next;
    },
    emit: (projectId = "project", id = plannerTicketsChanged.id, resourceIds?: string[]) => {
      for (const listener of listeners)
        listener({ type: "changed", id: `pstdio.pstdio-planner.event.${id}`, projectId, resourceIds });
    },
  };
};

test("Planner shares finite readers, filters project/ticket changes and keeps warm inactive data", async () => {
  const f = fixture();
  const plan = f.query("timeline");
  const ticket = f.query("requests", [plannerTicketsChanged], "ticket-a");
  const stops = [plan.subscribe(() => {}), f.query("timeline").subscribe(() => {}), ticket.subscribe(() => {})];
  await turn();
  expect(f.calls.get("plan")).toBe(2);
  f.emit("foreign");
  await turn();
  expect(f.calls.get("plan")).toBe(2);
  f.emit("project", plannerTicketsChanged.id, ["ticket-b"]);
  await turn();
  expect(f.calls.get("plan")).toBe(3);
  for (const stop of stops) stop();
  const stop = f.query("timeline").subscribe(() => {});
  await turn();
  expect(f.calls.get("plan")).toBe(3);
  stop();
  for (let index = 0; index < 50; index++) f.emit();
  await turn();
  expect(f.calls.get("plan")).toBe(3);
  const returned = plan.subscribe(() => {});
  await turn();
  expect(f.calls.get("plan")).toBe(4);
  returned();
  f.client.queries.dispose();
  expect(f.listeners.size).toBe(0);
});

test("a Planner refresh failure retains accepted data and recovers through explicit retry", async () => {
  const f = fixture();
  const query = f.query("failure");
  const stop = query.subscribe(() => {});
  await turn();
  const accepted = query.getSnapshot().data;
  f.setFailed(true);
  f.emit();
  await turn();
  expect(query.getSnapshot().data).toBe(accepted);
  expect(query.getSnapshot().error?.message).toBe("Planner is unavailable");
  expect(f.calls.get("plan")).toBe(2);
  f.setFailed(false);
  query.invalidate();
  await turn();
  expect(query.getSnapshot().error).toBeUndefined();
  expect(f.calls.get("plan")).toBe(3);
  stop();
  f.client.queries.dispose();
});

test("accepted configuration fences an older read and reconciles live session fields", async () => {
  const f = fixture();
  const read = () => Promise.resolve({ enabled: false, sessions: ["old"] });
  const query = createPlannerQuery(f.client, "mode", read, []);
  await query.read();
  const waiting = Promise.withResolvers<{ enabled: boolean; sessions: string[] }>();
  createPlannerQuery(f.client, "mode", () => waiting.promise, []);
  const stop = query.subscribe(() => {});
  query.invalidate();
  await turn();
  updatePlannerQuery(query, (current) => (current ? { ...current, enabled: true } : current));
  expect(query.getSnapshot().data).toEqual({ enabled: true, sessions: ["old"] });
  createPlannerQuery(f.client, "mode", () => Promise.resolve({ enabled: true, sessions: ["new"] }), []);
  waiting.resolve({ enabled: false, sessions: ["old"] });
  await turn();
  expect(query.getSnapshot().data).toEqual({ enabled: true, sessions: ["new"] });
  stop();
  f.client.queries.dispose();
});

test("production ticket request events refresh their exact ticket without rereading another ticket", async () => {
  const f = fixture();
  const query = f.query("requests", [plannerTicketsChanged], "ticket-a");
  const stop = query.subscribe(() => {});
  await turn();
  const context = {
    events: {
      emit: async (ref: { id: string }, _payload: unknown, options?: { refresh?: object }) => {
        for (const listener of f.listeners)
          listener({
            type: "changed",
            id: `pstdio.pstdio-planner.event.${ref.id}`,
            projectId: "project",
            ...options?.refresh,
          });
      },
    },
  } as unknown as Parameters<typeof publishRequestChange>[0];
  await publishRequestChange(context, "ticket-b");
  await turn();
  expect(f.calls.get("plan")).toBe(1);
  await publishRequestChange(context, "ticket-a");
  await turn();
  expect(f.calls.get("plan")).toBe(2);
  stop();
  f.client.queries.dispose();
});
