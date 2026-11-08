import { expect, test } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { createExtensionActions, getExtensionActions } from "./extension-actions";

const labels = { running: "Upgrading", success: "Upgraded", failed: "Upgrade failed" };
test("list and detail hosts share running actions and cannot upgrade the same extension twice", async () => {
  const client = new QueryClient();
  const list = getExtensionActions(client, "project");
  const detail = getExtensionActions(client, "project");
  expect(list).toBe(detail);
  expect(getExtensionActions(client, "another-project")).not.toBe(list);
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
  expect(detail.getSnapshot().actions.notes?.status).toBe("success");
});
test("continues a batch after a failure and retains its elapsed time after row dismissal", async () => {
  const actions = createExtensionActions();
  let completed = 0;
  await actions.runBatch([{ id: "one" }, { id: "two" }, { id: "three" }], "Queued", ({ id }) =>
    actions.run(id, labels, async () => {
      if (id === "one") throw new Error("Registry unavailable");
      completed++;
    }),
  );
  expect(completed).toBe(2);
  const batch = actions.getSnapshot().batch;
  expect(batch?.finishedAt).toBeNumber();
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
  expect(actions.getSnapshot().actions.upload?.status).toBe("success");
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
