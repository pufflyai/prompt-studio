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
  expect(operations.getSnapshot().recovery.map(({ draft }) => draft)).toEqual(["Newer"]);
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
