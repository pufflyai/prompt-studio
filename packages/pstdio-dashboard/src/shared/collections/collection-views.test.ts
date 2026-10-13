import { afterEach, expect, test } from "bun:test";
import { getWriter, markInitialCollectionsSyncComplete } from "@/lib/sync/collections";
import { createSharedCollectionViews } from "./collection-views";

const writer = getWriter("board_views")!;
const row = (id: string, sortOrder: number) => ({
  id,
  project_id: "project",
  extension_instance_id: null,
  board_id: "table",
  title: id,
  settings: {},
  filter: { conjunction: "and", rules: [] },
  sorts: [],
  sort_order: sortOrder,
  created_at: "2026-10-13",
});
const ids = (source: ReturnType<typeof createSharedCollectionViews>) =>
  source.getSnapshot()!.views.map((view) => view.id);
const config = Object.getOwnPropertyDescriptor(globalThis, "__PSTDIO_CONFIG__");
const servers: ReturnType<typeof Bun.serve>[] = [];

afterEach(() => {
  for (const server of servers) server.stop(true);
  servers.length = 0;
  writer.truncateAndWrite([]);
  if (config) Object.defineProperty(globalThis, "__PSTDIO_CONFIG__", config);
  else Reflect.deleteProperty(globalThis, "__PSTDIO_CONFIG__");
});

const setup = (handle: (request: Request) => Promise<Response> | Response) => {
  const server = Bun.serve({
    port: 0,
    fetch: (request) => (request.method === "PUT" ? handle(request) : Response.json({})),
  });
  servers.push(server);
  Object.defineProperty(globalThis, "__PSTDIO_CONFIG__", {
    configurable: true,
    value: { apiBaseUrl: server.url.origin },
  });
  writer.truncateAndWrite([row("a", 0), row("b", 1), row("c", 2)]);
  markInitialCollectionsSyncComplete();
  return createSharedCollectionViews({
    projectId: "project",
    extensionInstanceId: null,
    localId: "table",
    record: { id: "table" },
  });
};

test("saved view order updates immediately and follows sync after saving", async () => {
  const response = Promise.withResolvers<Response>();
  const request = Promise.withResolvers<Request>();
  const source = setup((incoming) => {
    request.resolve(incoming);
    return response.promise;
  });
  const notifications: string[][] = [];
  const unsubscribe = source.subscribe(() => notifications.push(ids(source)));
  try {
    const save = source.getSnapshot()!.onReorderViews!(["c", "a", "b"]);
    expect(ids(source)).toEqual(["c", "a", "b"]);
    expect(notifications).toContainEqual(["c", "a", "b"]);
    const incoming = await request.promise;
    expect(new URL(incoming.url).pathname).toBe("/v1/projects/project/boards/table/views/order");
    expect(await incoming.json()).toEqual({ viewIds: ["c", "a", "b"] });
    response.resolve(Response.json({}));
    await save;
    expect(ids(source)).toEqual(["c", "a", "b"]);
    // Partial sync events must not flash the old order or hide other saved changes.
    writer.upsert({ ...row("a", 1), title: "Renamed" });
    expect(ids(source)).toEqual(["c", "a", "b"]);
    expect(source.getSnapshot()!.views.find((view) => view.id === "a")!.title).toBe("Renamed");
    writer.upsert(row("b", 2));
    writer.upsert(row("c", 0));
    expect(ids(source)).toEqual(["c", "a", "b"]);
    // Once sync catches up, another client's order becomes authoritative again.
    writer.truncateAndWrite([row("b", 0), row("a", 1), row("c", 2)]);
    expect(ids(source)).toEqual(["b", "a", "c"]);
  } finally {
    unsubscribe();
  }
});

test("a failed reorder restores synced order and preserves synced view edits", async () => {
  const response = Promise.withResolvers<Response>();
  const source = setup(() => response.promise);
  const save = source.getSnapshot()!.onReorderViews!(["c", "a", "b"]);
  writer.upsert({ ...row("a", 0), title: "Renamed" });
  response.resolve(Response.json({ error: "Save failed" }, { status: 500 }));
  let failure: unknown;
  try {
    await save;
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(Error);
  expect(ids(source)).toEqual(["a", "b", "c"]);
  expect(source.getSnapshot()!.views[0]!.title).toBe("Renamed");
});

test("an older failed reorder preserves a newer order", async () => {
  const first = Promise.withResolvers<Response>();
  const second = Promise.withResolvers<Response>();
  const source = setup(async (request) => {
    const { viewIds } = (await request.json()) as { viewIds: string[] };
    return viewIds[0] === "c" ? first.promise : second.promise;
  });
  const oldSave = source.getSnapshot()!.onReorderViews!(["c", "a", "b"]);
  // Attach the failure handler before the newer request can complete.
  const oldFailure = oldSave.catch((error: unknown) => error);
  const newSave = source.getSnapshot()!.onReorderViews!(["b", "c", "a"]);
  first.resolve(Response.json({ error: "Save failed" }, { status: 500 }));
  expect(await oldFailure).toBeInstanceOf(Error);
  expect(ids(source)).toEqual(["b", "c", "a"]);
  second.resolve(Response.json({}));
  await newSave;
  expect(ids(source)).toEqual(["b", "c", "a"]);
});

test("partial sync keeps the intended order until every saved position arrives", async () => {
  const source = setup(() => Response.json({}));
  writer.truncateAndWrite([row("a", 0), row("z", 1), row("c", 2), row("b", 3)]);
  const order = ["a", "b", "z", "c"];
  await source.getSnapshot()!.onReorderViews!(order);
  writer.upsert(row("b", 1));
  expect(ids(source)).toEqual(order);
  writer.upsert(row("z", 2));
  expect(ids(source)).toEqual(order);
  writer.upsert(row("c", 3));
  expect(ids(source)).toEqual(order);
});

test.each([
  "add",
  "delete",
])("a concurrent view %s supersedes pending order and keeps live sync authoritative", async (change) => {
  const source = setup(() => Response.json({}));
  await source.getSnapshot()!.onReorderViews!(["c", "a", "b"]);
  if (change === "add") writer.upsert(row("d", 3));
  else writer.remove("c");
  const order = change === "add" ? ["b", "a", "c", "d"] : ["b", "a"];
  writer.truncateAndWrite(order.map(row));
  expect(ids(source)).toEqual(order);
});
