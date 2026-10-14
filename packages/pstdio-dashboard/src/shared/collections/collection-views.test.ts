import { afterEach, expect, test } from "bun:test";
import { cleanup, ids, row, setup, writer } from "./collection-views.test-support";

afterEach(cleanup);

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

test("a reconnect snapshot supersedes a saved move whose sync events were missed", async () => {
  const source = setup(() => Response.json({}));
  const unsubscribe = source.subscribe(() => source.getSnapshot());
  try {
    await source.getSnapshot()!.onReorderViews!(["c", "a", "b"]);
    expect(ids(source)).toEqual(["c", "a", "b"]);
    writer.truncateAndWrite([row("b", 0), row("a", 1), row("c", 2)]);
    expect(ids(source)).toEqual(["b", "a", "c"]);
  } finally {
    unsubscribe();
  }
});

test("a snapshot during saving keeps the pending move until the save completes", async () => {
  const response = Promise.withResolvers<Response>();
  const source = setup(
    () => response.promise,
    () => ["c", "a", "b"],
  );
  const unsubscribe = source.subscribe(() => source.getSnapshot());
  try {
    const save = source.getSnapshot()!.onReorderViews!(["c", "a", "b"]);
    writer.truncateAndWrite([row("a", 0), row("b", 1), row("c", 2)]);
    expect(ids(source)).toEqual(["c", "a", "b"]);
    response.resolve(Response.json({}));
    await save;
    writer.truncateAndWrite([row("c", 0), row("a", 1), row("b", 2)]);
    expect(ids(source)).toEqual(["c", "a", "b"]);
  } finally {
    unsubscribe();
  }
});

test("a newer snapshot before the delayed save response is reconciled with current server order", async () => {
  const response = Promise.withResolvers<Response>();
  const committed = Promise.withResolvers<void>();
  const source = setup(
    () => {
      committed.resolve();
      return response.promise;
    },
    () => ["b", "a", "c"],
  );
  const unsubscribe = source.subscribe(() => source.getSnapshot());
  try {
    const save = source.getSnapshot()!.onReorderViews!(["c", "a", "b"]);
    await committed.promise;
    writer.truncateAndWrite([row("b", 0), row("a", 1), row("c", 2)]);
    response.resolve(Response.json({}));
    await save;
    expect(ids(source)).toEqual(["b", "a", "c"]);
  } finally {
    unsubscribe();
  }
});

test("a failed read after saving keeps the acknowledged move until sync recovers", async () => {
  const response = Promise.withResolvers<Response>();
  const source = setup(
    () => response.promise,
    () => Response.json({ error: "Read failed" }, { status: 500 }),
  );
  const unsubscribe = source.subscribe(() => source.getSnapshot());
  try {
    const save = source.getSnapshot()!.onReorderViews!(["c", "a", "b"]);
    writer.truncateAndWrite([row("b", 0), row("a", 1), row("c", 2)]);
    response.resolve(Response.json({}));
    await save;
    expect(ids(source)).toEqual(["c", "a", "b"]);
    writer.truncateAndWrite([row("b", 0), row("a", 1), row("c", 2)]);
    expect(ids(source)).toEqual(["b", "a", "c"]);
  } finally {
    unsubscribe();
  }
});

test("a delayed reconciliation read cannot replace a newer local move", async () => {
  const response = Promise.withResolvers<Response>();
  const read = Promise.withResolvers<Response>();
  const reading = Promise.withResolvers<void>();
  const initialRead = Promise.withResolvers<void>();
  let holdRead = false;
  const source = setup(
    (request) => request.json().then(({ viewIds }) => (viewIds[0] === "c" ? response.promise : Response.json({}))),
    () => {
      if (!holdRead) {
        initialRead.resolve();
        return ["a", "b", "c"];
      }
      reading.resolve();
      return read.promise;
    },
  );
  const unsubscribe = source.subscribe(() => source.getSnapshot());
  try {
    await initialRead.promise;
    const first = source.getSnapshot()!.onReorderViews!(["c", "a", "b"]);
    writer.truncateAndWrite([row("b", 0), row("a", 1), row("c", 2)]);
    holdRead = true;
    response.resolve(Response.json({}));
    await reading.promise;
    await source.getSnapshot()!.onReorderViews!(["a", "c", "b"]);
    read.resolve(Response.json({ views: ["b", "a", "c"].map((id) => ({ id })) }));
    await first;
    expect(ids(source)).toEqual(["a", "c", "b"]);
  } finally {
    unsubscribe();
  }
});

test.each(["order", "title"])("a delayed reconciliation read respects newer synced %s changes", async (change) => {
  const response = Promise.withResolvers<Response>();
  const read = Promise.withResolvers<Response>();
  const reading = Promise.withResolvers<void>();
  const initialRead = Promise.withResolvers<void>();
  let holdRead = false;
  const source = setup(
    () => response.promise,
    () => {
      if (!holdRead) {
        initialRead.resolve();
        return ["a", "b", "c"];
      }
      reading.resolve();
      return read.promise;
    },
  );
  const unsubscribe = source.subscribe(() => source.getSnapshot());
  try {
    await initialRead.promise;
    const save = source.getSnapshot()!.onReorderViews!(["c", "a", "b"]);
    writer.truncateAndWrite([row("b", 0), row("a", 1), row("c", 2)]);
    holdRead = true;
    response.resolve(Response.json({}));
    await reading.promise;
    if (change === "order") {
      writer.upsert(row("c", 0));
      writer.upsert(row("b", 1));
      writer.upsert(row("a", 2));
    } else writer.upsert({ ...row("a", 1), title: "Renamed" });
    read.resolve(Response.json({ views: ["b", "a", "c"].map((id) => ({ id })) }));
    await save;
    expect(ids(source)).toEqual(change === "order" ? ["c", "b", "a"] : ["b", "a", "c"]);
    if (change === "title") expect(source.getSnapshot()!.views[1]!.title).toBe("Renamed");
  } finally {
    unsubscribe();
  }
});

test("partial saved positions during reconciliation keep the intended order", async () => {
  const response = Promise.withResolvers<Response>();
  const read = Promise.withResolvers<Response>();
  const initialRead = Promise.withResolvers<void>();
  const reading = Promise.withResolvers<void>();
  let holdRead = false;
  const source = setup(
    () => response.promise,
    () => {
      if (!holdRead) {
        initialRead.resolve();
        return ["a", "b", "c"];
      }
      reading.resolve();
      return read.promise;
    },
  );
  const unsubscribe = source.subscribe(() => source.getSnapshot());
  try {
    await initialRead.promise;
    const save = source.getSnapshot()!.onReorderViews!(["c", "a", "b"]);
    writer.truncateAndWrite([row("a", 0), row("b", 1), row("c", 2)]);
    holdRead = true;
    response.resolve(Response.json({}));
    await reading.promise;
    writer.upsert(row("c", 0));
    read.resolve(Response.json({ views: ["c", "a", "b"].map((id) => ({ id })) }));
    await save;
    expect(ids(source)).toEqual(["c", "a", "b"]);
    writer.upsert(row("a", 1));
    writer.upsert(row("b", 2));
    expect(ids(source)).toEqual(["c", "a", "b"]);
  } finally {
    unsubscribe();
  }
});

test("another project's view order does not supersede this project's pending move", async () => {
  const source = setup(() => Response.json({}));
  writer.upsert({ ...row("other-view", 0), project_id: "other-project" });
  const unsubscribe = source.subscribe(() => source.getSnapshot());
  try {
    await source.getSnapshot()!.onReorderViews!(["c", "a", "b"]);
    writer.upsert({ ...row("other-view", 1), project_id: "other-project" });
    expect(ids(source)).toEqual(["c", "a", "b"]);
  } finally {
    unsubscribe();
  }
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
