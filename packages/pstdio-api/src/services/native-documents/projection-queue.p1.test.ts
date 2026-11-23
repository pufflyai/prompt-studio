import { expect, test } from "bun:test";
import { expectRejection } from "../../test-utils/expect-rejection";
import { createProjectWork } from "../project-work";
import { createNativeProjectionQueue } from "./projection-queue";

test("a failed projection still processes a newer queued change", async () => {
  const first = Promise.withResolvers<number>();
  const started = Promise.withResolvers<void>();
  let calls = 0;
  let failures = 0;
  const address = { owner: { workbenchId: "project", extensionId: "example.source" }, documentKey: "source" };
  const queue = createNativeProjectionQueue({
    reconcile: async () => {
      if (++calls === 1) {
        started.resolve();
        return first.promise;
      }
      return 2;
    },
    failed: () => failures++,
  });
  const initial = queue.through(address, 1);
  await started.promise;
  const newer = queue.through(address, 2);
  const results = Promise.allSettled([initial, newer]);
  first.reject(new Error("The earlier projection failed"));
  expect(await results).toEqual([
    { status: "fulfilled", value: undefined },
    { status: "fulfilled", value: undefined },
  ]);
  await queue.drain();
  expect(calls).toBe(2);
  expect(failures).toBe(0);
});

test("a failed projection rejects when no newer change is queued", async () => {
  const failure = new Error("Projection failed");
  let calls = 0;
  const reported: unknown[] = [];
  const address = { owner: { workbenchId: "project", extensionId: "example.source" }, documentKey: "source" };
  const queue = createNativeProjectionQueue({
    reconcile: async () => {
      calls++;
      throw failure;
    },
    failed: (_address, error) => reported.push(error),
  });
  await expectRejection(queue.through(address, 1)).toBe(failure);
  await queue.drain();
  expect(calls).toBe(1);
  expect(reported).toEqual([failure]);
});

test("a captured projection fence completes while a later trailing projection remains pending", async () => {
  const first = Promise.withResolvers<void>();
  const firstStarted = Promise.withResolvers<void>();
  const trailing = Promise.withResolvers<void>();
  const trailingStarted = Promise.withResolvers<void>();
  let revision = 0;
  const address = { owner: { workbenchId: "project", extensionId: "example.source" }, documentKey: "source" };
  const queue = createNativeProjectionQueue({
    reconcile: async () => {
      if (revision === 0) {
        firstStarted.resolve();
        await first.promise;
        return ++revision;
      }
      trailingStarted.resolve();
      await trailing.promise;
      return ++revision;
    },
    failed: () => {},
  });
  const captured = queue.through(address, 1);
  await firstStarted.promise;
  const later = queue.through(address, 2);
  first.resolve();
  await trailingStarted.promise;
  try {
    await captured;
    expect(revision).toBe(1);
  } finally {
    trailing.resolve();
    await later;
    await queue.drain();
  }
});

test("a trailing projection uses the admitted editor lease while removal drains", async () => {
  const work = createProjectWork();
  const entered = Promise.withResolvers<void>();
  const resume = Promise.withResolvers<void>();
  const address = { owner: { workbenchId: "project", extensionId: "example.source" }, documentKey: "source" };
  let calls = 0;
  const queue = createNativeProjectionQueue({
    reconcile: () =>
      work.run("project", async () => {
        if (++calls === 1) {
          entered.resolve();
          await resume.promise;
          return 1;
        }
        return 2;
      }),
    failed: () => {},
  });
  const watcher = queue.request(address);
  await entered.promise;
  const editorEntered = Promise.withResolvers<void>();
  const editorResume = Promise.withResolvers<void>();
  const editor = work.run("project", async () => {
    editorEntered.resolve();
    await editorResume.promise;
    await queue.through(address, 2);
  });
  const result = editor.catch((error) => error);
  try {
    await editorEntered.promise;
    work.freeze("project");
    editorResume.resolve();
    await Promise.resolve();
    resume.resolve();
    expect(await result).toBeUndefined();
    await watcher;
    await work.drain("project");
    await expectRejection(queue.request(address)).toThrow("removing its copy");
  } finally {
    editorResume.resolve();
    resume.resolve();
    await result;
    await queue.drain();
    work.release("project");
  }
});

test("background work joining an editor's queue cannot borrow its live removal lease", async () => {
  const work = createProjectWork();
  const entered = Promise.withResolvers<void>();
  const resume = Promise.withResolvers<void>();
  const admitted = Promise.withResolvers<void>();
  const finishEditor = Promise.withResolvers<void>();
  const address = { owner: { workbenchId: "project", extensionId: "example.source" }, documentKey: "source" };
  let calls = 0;
  const queue = createNativeProjectionQueue({
    reconcile: () =>
      work.run("project", async () => {
        calls++;
        entered.resolve();
        await resume.promise;
        return calls;
      }),
    failed: () => {},
  });
  const editor = work.run("project", async () => {
    await queue.through(address, 1);
    admitted.resolve();
    await finishEditor.promise;
  });
  await entered.promise;
  work.freeze("project");
  const background = queue.request(address).catch((error) => error);
  try {
    resume.resolve();
    await admitted.promise;
    expect(await background).toBeInstanceOf(Error);
    expect(calls).toBe(1);
  } finally {
    resume.resolve();
    finishEditor.resolve();
    await editor;
    await queue.drain();
    work.release("project");
  }
});
