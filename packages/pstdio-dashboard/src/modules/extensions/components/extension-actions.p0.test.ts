import { expect, test } from "bun:test";
import { PstdioApiError, PstdioConnectionError } from "@pstdio/sdk/client";
import { createScopedQueryClient } from "@pstdio/sdk/extensions";
import { getWorkbenchOperations } from "@pstdio/workbench";
import { extensionUpgradeNeedsReviewCode } from "pstdio-api-contracts/extension-host";
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
test("keeps a local conflict in the batch review count while other upgrades finish", async () => {
  const actions = createExtensionActions();
  await actions.runBatch([{ id: "local" }, { id: "clean" }], ({ id }) =>
    actions.run(id, labels, async () => {
      if (id === "local") {
        throw new PstdioApiError("This project uses a local copy.", 409, extensionUpgradeNeedsReviewCode);
      }
    }),
  );
  expect(actions.getSnapshot().batch).toMatchObject({ running: false, completed: 2, failed: 0, reviewRequired: 1 });
  expect(actions.getSnapshot().actions.local?.needsReview).toBe(true);
  expect(actions.getSnapshot().actions.clean).toBeUndefined();
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

test("reinstalling clears a stale failure and retry from the restored instance", async () => {
  const owner = createExtensionActions();
  let attempts = 0;
  await owner.run("notes-instance", labels, async () => {
    attempts++;
    throw new Error("Original install could not upgrade");
  });

  const install = () =>
    owner.run("marketplace:notes", { running: "Installing", failed: "Install failed" }, async () => "notes-instance", {
      installedId: (id) => id,
    });
  await install();
  expect(owner.getSnapshot().actions["notes-instance"]).toBeUndefined();
  owner.retry("notes-instance");
  expect(attempts).toBe(1);

  const gate = Promise.withResolvers<void>();
  const upgrade = owner.run("notes-instance", labels, () => gate.promise);
  await install();
  expect(owner.getSnapshot().actions["notes-instance"]?.status).toBe("running");
  gate.resolve();
  await upgrade;
});

test("uncertain installs remain blocked across views and dismissal until the draft is discarded", async () => {
  const queries = createScopedQueryClient({ runtimeId: "dashboard", extensionId: "pstdio" });
  const operations = getWorkbenchOperations(queries);
  const inventory = {};
  const list = getExtensionActions(inventory, { projectId: "project", operations });
  const detail = getExtensionActions(inventory, { projectId: "project", operations });
  const key = "marketplace:notes";
  const installLabels = { running: "Installing", failed: "Install failed" };
  let writes = 0;
  const draft = { extension: "Notes", installName: "notes" };
  const submit = (view: typeof list) =>
    view.run(
      key,
      installLabels,
      async () => {
        writes++;
        if (writes === 1) throw new PstdioConnectionError(new Error("Response lost"));
      },
      { draft },
    );

  expect(await submit(list)).toBe(false);
  const entry = operations.getSnapshot().recovery[0];
  expect(entry).toMatchObject({ projectId: "project", status: "unknown", draft, canCheck: false });
  expect(detail.getSnapshot().actions[key]).toMatchObject({ retryable: false });
  detail.dismiss(key);
  expect(await submit(detail)).toBe(false);
  expect(writes).toBe(1);
  expect(operations.getSnapshot().recovery[0]?.draft).toEqual(draft);
  operations.discard(entry.id);
  expect(await submit(detail)).toBe(true);
  expect(writes).toBe(2);
  queries.dispose();
});

test.each([
  "toggle",
  "upgrade",
] as const)("discard releases an uncertain installed extension %s without replaying it", async (operation) => {
  const queries = createScopedQueryClient({ runtimeId: "dashboard", extensionId: "pstdio" });
  const operations = getWorkbenchOperations(queries);
  const owner = createExtensionActions({ projectId: "project", operations });
  const key = "notes-instance";
  let writes = 0;
  const submit = () =>
    owner.run(
      key,
      labels,
      async () => {
        if (++writes === 1) throw new PstdioConnectionError(new Error("Response lost"));
      },
      { ...(operation === "toggle" ? { operation } : {}), draft: { id: key, operation } },
    );
  try {
    expect(await submit()).toBe(false);
    const entry = operations.getSnapshot().recovery[0]!;
    expect(owner.getSnapshot().actions[key]).toMatchObject({ retryable: false });
    owner.dismiss(key);
    expect(await submit()).toBe(false);
    operations.discard(entry.id);
    expect(operations.getSnapshot().recovery).toEqual([]);
    expect(owner.getSnapshot().actions[key]).toBeUndefined();
    expect(writes).toBe(1);
    expect(await submit()).toBe(true);
    expect(writes).toBe(2);
  } finally {
    queries.dispose();
  }
});

test("an installed extension action stays fenced after returning to its original account", async () => {
  const queries = createScopedQueryClient({ runtimeId: "dashboard", extensionId: "pstdio", accountId: "original" });
  const operations = getWorkbenchOperations(queries);
  const tracker = { projectId: "project", operations };
  const key = "notes-instance";
  let writes = 0;
  const write = async () => {
    if (++writes === 1) throw new PstdioConnectionError(new Error("Response lost"));
  };
  try {
    expect(await createExtensionActions(tracker).run(key, labels, write, { draft: { id: key } })).toBe(false);
    const id = operations.getSnapshot().recovery[0]!.id;
    queries.setAuthority({ accountId: "other" });
    queries.setAuthority({ accountId: "original" });
    const reopened = createExtensionActions(tracker);
    expect(await reopened.run(key, labels, write)).toBe(false);
    expect(writes).toBe(1);
    operations.discard(id);
    expect(await reopened.run(key, labels, write)).toBe(true);
    expect(writes).toBe(2);
  } finally {
    queries.dispose();
  }
});
