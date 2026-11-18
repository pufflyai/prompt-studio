import { expect, test } from "bun:test";
import { createExtensionActions, getExtensionActions } from "./extension-actions";

const labels = { running: "Upgrading", failed: "Upgrade failed" };
test("list and detail hosts share running actions and cannot upgrade the same extension twice", async () => {
  const inventory = {};
  const list = getExtensionActions(inventory);
  const detail = getExtensionActions(inventory);
  expect(list).toBe(detail);
  expect(getExtensionActions({})).not.toBe(list);
  const gate = Promise.withResolvers<void>();
  const pending = list.run("notes", labels, () => gate.promise);
  expect(detail.getSnapshot().actions.notes?.status).toBe("running");
  let duplicate = false;
  expect(
    await detail.run("notes", labels, async () => {
      duplicate = true;
    }),
  ).toBe(false);
  expect(duplicate).toBe(false);
  gate.resolve();
  await pending;
  expect(detail.getSnapshot().actions.notes).toBeUndefined();
});
test("continues a batch after a failure and retains its summary after row dismissal", async () => {
  const actions = createExtensionActions();
  let completed = 0;
  await actions.runBatch([{ id: "one" }, { id: "two" }, { id: "three" }], ({ id }) =>
    actions.run(id, labels, async () => {
      if (id === "one") throw new Error("Registry unavailable");
      completed++;
    }),
  );
  expect(completed).toBe(2);
  const batch = actions.getSnapshot().batch;
  expect(batch).toMatchObject({ running: false, completed: 3, failed: 1 });
  expect(actions.getSnapshot().actions.one?.error).toBe("Registry unavailable");
  actions.dismiss("two");
  expect(actions.getSnapshot().batch).toEqual(batch);
});
test("retries failed work, but releases retry callbacks on success and dismissal", async () => {
  const actions = createExtensionActions();
  let calls = 0;
  await actions.run("upload", labels, async () => {
    if (++calls === 1) throw new Error("Offline");
  });
  actions.retry("upload");
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(calls).toBe(2);
  expect(actions.getSnapshot().actions.upload).toBeUndefined();
  actions.retry("upload");
  expect(calls).toBe(2);
  await actions.run("upload", labels, async () => {
    calls++;
    throw new Error("Offline");
  });
  actions.dismiss("upload");
  actions.retry("upload");
  expect(calls).toBe(3);
});

test("dismissing an older result cannot clear a newer operation or its retry", async () => {
  const actions = createExtensionActions();
  await actions.run("notes", labels, async () => {
    throw new Error("Previous failure");
  });
  const older = actions.getSnapshot().actions.notes!;
  await actions.run("notes", labels, async () => {
    throw new Error("New failure");
  });
  const latest = actions.getSnapshot().actions.notes!;
  actions.dismiss("notes", older);
  expect(actions.getSnapshot().actions.notes).toBe(latest);
  actions.dismiss("notes", latest);
  expect(actions.getSnapshot().actions.notes).toBeUndefined();
});

test("batch counts and failure outcome survive individual dismissal and reject stale batch dismissal", async () => {
  const actions = createExtensionActions();
  const gate = Promise.withResolvers<void>();
  const pending = actions.runBatch([{ id: "one" }, { id: "two" }], ({ id }) =>
    actions.run(id, labels, async () => {
      if (id === "one") throw new Error("Offline");
      await gate.promise;
    }),
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(actions.getSnapshot().batch?.completed).toBe(1);
  expect(actions.getSnapshot().batch?.failed).toBe(1);
  actions.dismiss("one");
  gate.resolve();
  await pending;
  const older = actions.getSnapshot().batch!;
  expect(older.completed).toBe(2);
  expect(older.failed).toBe(1);
  await actions.runBatch([{ id: "one" }], ({ id }) =>
    actions.run(id, labels, async () => {
      throw new Error("Still offline");
    }),
  );
  const latest = actions.getSnapshot().batch!;
  actions.dismissBatch(older);
  expect(actions.getSnapshot().batch).toBe(latest);
  actions.dismissBatch(latest);
  expect(actions.getSnapshot().batch).toBeUndefined();
});

test("a retried install retains its exact instance for navigation and clears its feedback", async () => {
  const owner = createExtensionActions();
  const key = "marketplace:pi";
  let calls = 0;
  await owner.run(
    key,
    { running: "Installing", failed: "Install failed" },
    async () => {
      if (++calls === 1) throw new Error("Registry unavailable");
      return "new-installed-instance";
    },
    { installedId: (id) => id },
  );
  expect(owner.getSnapshot().actions[key]?.status).toBe("error");
  owner.retry(key);
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(calls).toBe(2);
  expect(owner.getSnapshot().installedIds[key]).toBe("new-installed-instance");
  expect(owner.getSnapshot().actions).toEqual({});
  owner.retry(key);
  expect(calls).toBe(2);
});
