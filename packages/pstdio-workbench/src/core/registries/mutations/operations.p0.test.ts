import { expect, test } from "bun:test";
import { createScopedQueryClient } from "@pstdio/sdk/extensions";
import { getWorkbenchOperations, OperationCapacityError, operationSubject } from "./operations";

const setup = () => {
  const queries = createScopedQueryClient({ runtimeId: "desktop", accountId: "personal", extensionId: "pstdio" });
  const operations = getWorkbenchOperations(queries);
  const subject = operationSubject("ticket", "project", "planner", "device", "ticket-1");
  return { queries, operations, subject };
};

test("shares ordered projections across views while one write reconciles", async () => {
  const { queries, operations, subject } = setup();
  const otherView = getWorkbenchOperations(queries);
  const write = Promise.withResolvers<string>();
  const read = Promise.withResolvers<void>();
  const started: string[] = [];
  const project = (view: typeof operations) => view.getSnapshot().pending.map(({ intent }) => intent);

  const first = operations.submit({
    projectId: "project",
    subjects: [subject],
    domain: "title",
    intent: "First",
    title: "Rename ticket",
    write: () => {
      started.push("First");
      return write.promise;
    },
    reconcile: () => read.promise,
  });
  const next = otherView.submit({
    projectId: "project",
    subjects: [subject],
    domain: "title",
    intent: "Second",
    title: "Rename ticket",
    write: () => {
      started.push("Second");
    },
  });
  expect(project(operations)).toEqual(["First", "Second"]);
  expect(project(otherView)).toEqual(["First", "Second"]);
  await Promise.resolve();
  expect(started).toEqual(["First"]);
  write.resolve("First");
  await Promise.resolve();
  expect(project(otherView)).toEqual(["First", "Second"]);
  expect(started).toEqual(["First"]);
  read.resolve();
  await first.result;
  await next.result;
  expect(started).toEqual(["First", "Second"]);
  expect(project(otherView)).toEqual([]);
});

test("a rejection withdraws only its own intent and preserves the attempted draft", async () => {
  const { operations, subject } = setup();
  const first = Promise.withResolvers<void>();
  const second = Promise.withResolvers<void>();
  const failed = operations.submit({
    projectId: "project",
    subjects: [subject],
    domain: "title",
    intent: "First",
    title: "Rename ticket",
    draft: "First",
    write: () => first.promise,
    classify: () => "rejected",
  });
  const next = operations.submit({
    projectId: "project",
    subjects: [subject],
    domain: "title",
    intent: "Second",
    title: "Rename ticket",
    write: () => second.promise,
  });
  first.reject(new Error("Name rejected"));
  await expect(failed.result).rejects.toThrow("Name rejected");
  expect(operations.getSnapshot().pending.map(({ intent }) => intent)).toEqual(["Second"]);
  operations.dismiss(failed.id);
  expect(operations.getSnapshot().recovery[0]).toMatchObject({ draft: "First", dismissed: true });
  expect(await operations.transfer(failed.id, () => false)).toBe(false);
  expect(operations.getSnapshot().recovery).toHaveLength(1);
  expect(await operations.transfer(failed.id, (draft) => draft === "First")).toBe(true);
  expect(operations.getSnapshot().recovery).toHaveLength(0);
  second.resolve();
  await next.result;
});

test("a failed read after a handler failure fences later writes until the read succeeds", async () => {
  const { operations, subject } = setup();
  let reads = 0;
  let writes = 0;
  const attempted = operations.submit({
    subjects: [subject],
    domain: "controls",
    title: "Reset settings",
    write() {
      writes++;
      throw new Error("Handler failed after changing settings");
    },
    classify: () => "rejected",
    reconcileRejection() {
      if (++reads === 1) throw new Error("Read unavailable");
    },
  });
  const next = operations.submit({
    subjects: [subject],
    domain: "controls",
    title: "Apply settings",
    write: () => ++writes,
  });
  await expect(attempted.result).rejects.toThrow("Read unavailable");
  expect(operations.getSnapshot().recovery[0]).toMatchObject({ status: "unconfirmed", canCheck: true });
  expect(writes).toBe(1);
  await operations.check(attempted.id);
  expect(await next.result).toBe(2);
  expect(reads).toBe(2);
  expect(operations.getSnapshot().recovery[0]).toMatchObject({ status: "rejected", canCheck: false });
});

test("an unresolved create keeps the draft and blocks dependent writes after dismissal", async () => {
  const { operations, subject } = setup();
  let writes = 0;
  const unresolved = operations.submit({
    projectId: "project",
    subjects: [subject],
    domain: "create",
    intent: "Similar title",
    draft: "Similar title",
    title: "Create ticket",
    write: () => {
      throw new Error("Connection lost");
    },
  });
  const dependent = operations.submit({
    projectId: "project",
    subjects: [subject],
    domain: "edit",
    intent: "Follow-up",
    title: "Edit ticket",
    write: () => {
      ++writes;
    },
  });
  const unrelated = operations.submit({
    projectId: "project",
    subjects: [operationSubject("ticket", "project", "planner", "device", "ticket-2")],
    domain: "title",
    intent: "Unrelated",
    title: "Rename another ticket",
    write: () => {
      ++writes;
    },
  });
  await expect(unresolved.result).rejects.toThrow("Connection lost");
  await unrelated.result;
  expect(writes).toBe(1);
  expect(operations.getSnapshot().recovery[0]).toMatchObject({
    status: "unknown",
    canCheck: false,
    draft: "Similar title",
  });
  operations.dismiss(unresolved.id);
  operations.discard(unresolved.id);
  expect(operations.getSnapshot().recovery[0]).toMatchObject({ status: "unknown", draft: undefined });
  expect(operations.getSnapshot().pending.find(({ id }) => id === dependent.id)?.status).toBe("queued");
  expect(writes).toBe(1);
});

test("a successful write keeps its preview and admission barrier when reconciliation fails", async () => {
  const { operations, subject } = setup();
  let reads = 0;
  let writes = 0;
  const first = operations.submit({
    projectId: "project",
    subjects: [subject],
    domain: "title",
    intent: "First",
    title: "Rename ticket",
    write: () => {
      ++writes;
      return "First";
    },
    reconcile: () => {
      if (++reads === 1) throw new Error("Read failed");
    },
  });
  const second = operations.submit({
    projectId: "project",
    subjects: [subject],
    domain: "title",
    intent: "Second",
    title: "Rename ticket",
    write: () => {
      ++writes;
    },
  });
  await expect(first.result).rejects.toThrow("Read failed");
  expect(operations.getSnapshot().recovery[0]).toMatchObject({ status: "unconfirmed", canCheck: true });
  expect(operations.getSnapshot().pending.map(({ intent }) => intent)).toEqual(["First", "Second"]);
  expect(writes).toBe(1);
  await operations.check(first.id);
  await second.result;
  expect(operations.getSnapshot().pending).toEqual([]);
  expect({ reads, writes }).toEqual({ reads: 2, writes: 2 });
});

test("account retirement fences queued execution and isolates recovery even without query entries", async () => {
  const { queries, operations, subject } = setup();
  const gate = Promise.withResolvers<void>();
  let laterWrites = 0;
  const active = operations.submit({
    projectId: "project",
    subjects: [subject],
    domain: "title",
    intent: "Old",
    draft: "Old",
    title: "Rename ticket",
    write: () => gate.promise,
    reconcile: () => {
      ++laterWrites;
    },
  });
  const queued = operations.submit({
    projectId: "project",
    subjects: [subject],
    domain: "title",
    intent: "Newer",
    draft: "Newer",
    title: "Rename ticket",
    write: () => {
      ++laterWrites;
    },
  });
  await Promise.resolve();
  queries.setAuthority({ accountId: "work" });
  expect(operations.getSnapshot()).toMatchObject({ pending: [], recovery: [] });
  await expect(queued.result).rejects.toThrow("authority");
  await expect(active.result).rejects.toThrow("authority");
  queries.setAuthority({ accountId: "personal" });
  expect(operations.getSnapshot().pending).toEqual([]);
  expect(operations.getSnapshot().recovery.map(({ draft }) => draft)).toEqual(["Old", "Newer"]);
  gate.resolve();
  await Promise.resolve();
  expect(laterWrites).toBe(0);
  expect(operations.getSnapshot().recovery.map(({ draft }) => draft)).toEqual(["Old", "Newer"]);
});

test("retirement during reconciliation preserves recovery when the old read settles", async () => {
  const { queries, operations, subject } = setup();
  const reconciling = Promise.withResolvers<void>();
  const oldRead = Promise.withResolvers<void>();
  const attempt = operations.submit({
    projectId: "project",
    subjects: [subject],
    domain: "title",
    title: "Rename ticket",
    intent: "Original draft",
    draft: "Original draft",
    write: () => undefined,
    reconcile: () => {
      reconciling.resolve();
      return oldRead.promise;
    },
  });
  await reconciling.promise;
  queries.setAuthority({ accountId: "work" });
  await expect(attempt.result).rejects.toThrow("authority");
  oldRead.reject(new Error("Old read failed"));
  await Promise.resolve();
  expect(operations.getSnapshot()).toEqual({ pending: [], recovery: [] });

  queries.setAuthority({ accountId: "personal" });
  expect(operations.getSnapshot().recovery[0]).toMatchObject({
    id: attempt.id,
    draft: "Original draft",
    status: "unconfirmed",
    canCheck: false,
  });

  // An explicit new action is owned by the new authority lease.
  const executed = Promise.withResolvers<void>();
  const next = operations.submit({
    projectId: "project",
    subjects: [subject],
    domain: "title",
    title: "Rename ticket",
    write: () => executed.resolve(),
  });
  await Promise.resolve();
  expect(operations.getSnapshot().pending[0]?.status).toBe("writing");
  await executed.promise;
  await next.result;
  expect(operations.getSnapshot().recovery[0]?.draft).toBe("Original draft");
});

test("late transport rejection cannot reclassify retired recovery", async () => {
  const { queries, operations, subject } = setup();
  const transport = Promise.withResolvers<void>();
  const attempt = operations.submit({
    projectId: "project",
    subjects: [subject],
    domain: "title",
    title: "Rename ticket",
    draft: "Original draft",
    write: () => transport.promise,
    classify: () => "rejected",
  });
  await Promise.resolve();
  queries.setAuthority({ accountId: "work" });
  await expect(attempt.result).rejects.toThrow("authority");
  transport.reject(new Error("Old write failed"));
  await Promise.resolve();
  queries.setAuthority({ accountId: "personal" });
  expect(operations.getSnapshot().recovery[0]).toMatchObject({
    id: attempt.id,
    status: "unknown",
    draft: "Original draft",
  });
});

test("a draft transfer completing after retirement cannot release the original recovery", async () => {
  const { queries, operations, subject } = setup();
  const attempt = operations.submit({
    domain: "title",
    subjects: [subject],
    title: "Rename ticket",
    draft: "My draft",
    write: () => {
      throw new Error("Rejected");
    },
    classify: () => "rejected",
  });
  await expect(attempt.result).rejects.toThrow("Rejected");
  const received = Promise.withResolvers<boolean>();
  const transfer = operations.transfer(attempt.id, () => received.promise);
  queries.setAuthority({ accountId: "work" });
  received.resolve(true);
  expect(await transfer).toBe(false);
  queries.setAuthority({ accountId: "personal" });
  expect(operations.getSnapshot().recovery[0]?.draft).toBe("My draft");
  expect(await operations.transfer(attempt.id, () => true)).toBe(true);
});

test("disposing the runtime aborts active and queued operations without reconciling old data", async () => {
  const { queries, operations, subject } = setup();
  const transport = Promise.withResolvers<void>();
  let signal: AbortSignal | undefined;
  let writes = 0;
  let reconciliations = 0;
  const active = operations.submit({
    domain: "title",
    subjects: [subject],
    title: "Rename ticket",
    write: (current) => {
      writes++;
      signal = current;
      return transport.promise;
    },
    reconcile: () => {
      reconciliations++;
    },
  });
  const queued = operations.submit({
    domain: "title",
    subjects: [subject],
    title: "Rename ticket",
    write: () => {
      writes++;
    },
  });

  const outcomes = Promise.allSettled([active.result, queued.result]);
  await Promise.resolve();
  queries.dispose();
  expect(signal?.aborted).toBe(true);
  expect(operations.getSnapshot()).toEqual({ pending: [], recovery: [] });
  transport.resolve();
  expect((await outcomes).map(({ status }) => status)).toEqual(["rejected", "rejected"]);
  expect({ writes, reconciliations }).toEqual({ writes: 1, reconciliations: 0 });
});

test("capacity preserves all retained drafts and sends no new write", async () => {
  const { operations, subject } = setup();
  for (let index = 0; index < 128; index++) {
    const attempt = operations.submit({
      projectId: "project",
      subjects: [subject],
      domain: "title",
      intent: index,
      draft: index,
      title: "Rename ticket",
      write: () => {
        throw new Error("Rejected");
      },
      classify: () => "rejected",
    });
    await expect(attempt.result).rejects.toThrow("Rejected");
  }
  let wrote = false;
  expect(() =>
    operations.submit({
      projectId: "project",
      subjects: [subject],
      domain: "title",
      intent: 129,
      title: "Rename ticket",
      write: () => {
        wrote = true;
      },
    }),
  ).toThrow(OperationCapacityError);
  expect(operations.getSnapshot().recovery).toHaveLength(128);
  expect(wrote).toBe(false);
});

test("returning to the owning account can discard a retired project draft and free capacity", async () => {
  const { queries, operations, subject } = setup();
  const input = {
    projectId: "retired-project",
    subjects: [subject],
    domain: "test",
    title: "Change project",
    draft: "Preserve this draft",
    write: () => Promise.reject(new Error("Reply lost")),
  };
  try {
    for (let index = 0; index < 128; index++) {
      const attempt = operations.submit(input);
      await expect(attempt.result).rejects.toThrow("Reply lost");
      if (index === 0) {
        operations.discard(attempt.id);
        expect(operations.getSnapshot().pending[0]?.id).toBe(attempt.id);
      }
      queries.clearScope({ projectId: input.projectId });
    }
    const [original] = operations.getSnapshot().recovery;
    queries.setAuthority({ accountId: "different" });
    expect(operations.getSnapshot().recovery).toEqual([]);
    expect(() => operations.submit(input)).toThrow("switch to the account");
    operations.discard(original!.id);
    expect(() => operations.submit(input)).toThrow(OperationCapacityError);

    queries.setAuthority({ accountId: "personal" });
    operations.updateRetiredProjectAvailability(() => false);
    expect(operations.getSnapshot().recovery).toHaveLength(128);
    expect(operations.getSnapshot().recovery[0]).toMatchObject({
      retired: true,
      projectUnavailable: true,
      dismissed: true,
    });
    expect(operations.getSnapshot().recovery[0]?.draft).toBeUndefined();
    expect(operations.getSnapshot().recovery[1]?.draft).toBe(input.draft);
    operations.discard(original!.id);
    expect(operations.getSnapshot().recovery).toHaveLength(127);
    queries.setAuthority({ accountId: "different" });
    await operations.submit({ ...input, write: async () => {} }).result;
  } finally {
    queries.dispose();
  }
});
