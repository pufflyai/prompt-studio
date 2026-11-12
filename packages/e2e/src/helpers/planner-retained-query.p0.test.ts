import { expect, test } from "bun:test";
import { createWebviewClient } from "@pstdio/sdk/extensions";
import { publishRequestChange } from "../../../../extensions/pstdio-planner/src/data/review-request-service";
import { plannerTicketsChanged } from "../../../../extensions/pstdio-planner/src/events";
import { createRetainedExtensionQueryFixture } from "./retained-extension-query.fixture";

const turn = () => new Promise<void>((resolve) => setImmediate(resolve));
const fixture = () => {
  let failed = false,
    reads = 0;
  const transport = createRetainedExtensionQueryFixture({
    extensionId: "pstdio.pstdio-planner",
    execute: async () => {
      reads++;
      if (failed) throw new Error("Planner unavailable");
      return { projectId: "selected", sessions: ["current"] };
    },
  });
  const frame = transport.frame(),
    client = createWebviewClient(frame.host);
  const query = (id = "timeline", resourceId?: string) =>
    client.commands.read.query(
      { id },
      { events: [plannerTicketsChanged], ...(resourceId ? { dependency: { resourceId } } : {}) },
    );
  const emit = (project = "selected", resourceIds?: string[]) =>
    transport.emit("pstdio.pstdio-planner.event." + plannerTicketsChanged.id, project, resourceIds);
  return {
    query,
    emit,
    get reads() {
      return reads;
    },
    fail: (next: boolean) => {
      failed = next;
    },
    dispose() {
      client.queries.dispose();
      transport.dispose();
    },
  };
};
test("Planner readonly host queries share finite readers, filter scoped changes and keep inactive plans warm", async () => {
  const f = fixture();
  const plan = f.query(),
    ticket = f.query("request", "ticket-a");
  let stops = [plan.subscribe(() => {}), f.query().subscribe(() => {}), ticket.subscribe(() => {})];
  try {
    await Promise.all([plan.read(), ticket.read()]);
    expect(f.reads).toBe(2);
    f.emit("foreign");
    await turn();
    expect(f.reads).toBe(2);
    f.emit("selected", ["ticket-b"]);
    await turn();
    expect(f.reads).toBe(3);
    for (const stop of stops) stop();
    stops = [plan.subscribe(() => {})];
    await turn();
    expect(f.reads).toBe(3);
    stops[0]!();
    stops = [];
    for (let i = 0; i < 50; i++) f.emit();
    await turn();
    expect(f.reads).toBe(3);
    const accepted = plan.getSnapshot().data;
    stops = [plan.subscribe(() => {})];
    expect(plan.getSnapshot().data).toBe(accepted);
    await turn();
    expect(f.reads).toBe(4);
  } finally {
    for (const stop of stops) stop();
    f.dispose();
  }
});
test("Planner refresh errors preserve the accepted plan and recover through public Retry", async () => {
  const f = fixture(),
    query = f.query();
  const stop = query.subscribe(() => {});
  try {
    const accepted = await query.read();
    f.fail(true);
    await expect(query.refresh()).rejects.toThrow("Planner unavailable");
    expect(query.getSnapshot().data).toEqual(accepted);
    expect(query.getSnapshot().error?.message).toBe("Planner unavailable");
    f.fail(false);
    await query.refresh();
    expect(query.getSnapshot().error).toBeUndefined();
    expect(f.reads).toBe(3);
  } finally {
    stop();
    f.dispose();
  }
});
test("production review-request events refresh their exact ticket without rereading another ticket", async () => {
  const f = fixture(),
    query = f.query("request", "ticket-a");
  const stop = query.subscribe(() => {});
  try {
    await query.read();
    const ctx = {
      events: {
        emit: async (_ref: unknown, _payload: unknown, options?: { refresh?: { resourceIds?: string[] } }) => {
          f.emit("selected", options?.refresh?.resourceIds);
        },
      },
    } as unknown as Parameters<typeof publishRequestChange>[0];
    await publishRequestChange(ctx, "ticket-b");
    await turn();
    expect(f.reads).toBe(1);
    await publishRequestChange(ctx, "ticket-a");
    await turn();
    expect(f.reads).toBe(2);
  } finally {
    stop();
    f.dispose();
  }
});
