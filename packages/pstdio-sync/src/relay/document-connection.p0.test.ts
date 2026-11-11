import { expect, test } from "bun:test";
import { createDocumentRelayConnection } from "./document-connection";
import { documentConnectionFixture } from "./document-connection.test-fixture";

const documentId = "native_document_0123456789";
const directoryId = "owner_directory_0123456789";

test("subscription admission catches up exact text while its owner directory is held", async () => {
  const f = documentConnectionFixture({ heldTopic: documentId });
  const release = Promise.withResolvers<void>();
  const entered = Promise.withResolvers<void>();
  const caught = Promise.withResolvers<number>();
  const local = Promise.withResolvers<void>();
  let remote = 1,
    initial = 0,
    background = 0,
    textReads = 0;
  const owner = createDocumentRelayConnection({
    ...f,
    projectId: "project",
    signal: f.controller.signal,
    synchronize: async (_signal, subscribe) => {
      background++;
      subscribe(null, directoryId);
      initial = remote;
      subscribe(null, documentId);
      entered.resolve();
      await release.promise;
    },
    acceptsChange: (change) => change.spaceOwner === null && [directoryId, documentId].includes(change.documentId),
    synchronizeChanged: async (change) => {
      if (change.documentId !== documentId) return false;
      textReads++;
      caught.resolve(remote);
      return true;
    },
    synchronizeDocument: async (name) => {
      expect(name).toBe("text");
      local.resolve();
      return true;
    },
  });
  let other: ReturnType<typeof createDocumentRelayConnection> | undefined;
  try {
    await entered.promise;
    await f.held;
    expect(initial).toBe(1);
    remote = 2;
    f.admit();
    expect(await caught.promise).toBe(2);
    owner.wakeDocument("text");
    await local.promise;
    f.send({
      type: "discovered",
      spaceOwner: null,
      documentId: "foreign_document_0123456789",
      lastSequence: 1,
      stateId: null,
    });
    const admitted = Promise.withResolvers<void>();
    const stop = f.live.listen((event) => {
      if (event.type === "subscribed" && event.topic === "other_document_0123456789") admitted.resolve();
    });
    other = createDocumentRelayConnection({
      ...f,
      projectId: "project",
      signal: f.controller.signal,
      synchronize: async (_signal, subscribe) => subscribe(null, "other_document_0123456789"),
    });
    await admitted.promise;
    stop();
    expect(background).toBe(1);
    expect(textReads).toBe(1);
  } finally {
    release.resolve();
    f.controller.abort();
    await owner.done;
    await other?.done;
    await f.close();
  }
});

test("Retry cancels a stalled download and resumes on the same shared connection", async () => {
  const f = documentConnectionFixture();
  const entered = Promise.withResolvers<AbortSignal>();
  const release = Promise.withResolvers<void>();
  const retried = Promise.withResolvers<AbortSignal>();
  let passes = 0;
  let ready = 0;
  const owner = createDocumentRelayConnection({
    ...f,
    projectId: "project",
    signal: f.controller.signal,
    onReady: () => ready++,
    synchronize: async (signal) => {
      if (++passes === 1) {
        entered.resolve(signal);
        await Promise.race([
          release.promise,
          new Promise<void>((_resolve, reject) =>
            signal.addEventListener("abort", () => reject(signal.reason), { once: true }),
          ),
        ]);
      } else retried.resolve(signal);
    },
  });
  try {
    const original = await entered.promise;
    owner.retry();
    expect(original.aborted).toBe(true);
    const next = await retried.promise;
    expect(next).not.toBe(original);
    expect(next.aborted).toBe(false);
    expect(ready).toBe(2);
    expect(f.live.status().connected).toBe(true);
  } finally {
    release.resolve();
    f.controller.abort();
    await owner.done;
    await f.close();
  }
});

test("a shared socket renewal preserves a held owner attempt and queued work", async () => {
  const grant = Promise.withResolvers<{ token: string; expiresAt: string }>();
  const renewalEntered = Promise.withResolvers<void>();
  let grants = 0;
  const f = documentConnectionFixture({
    access: async () => {
      if (++grants === 1) return { token: "first", expiresAt: new Date(Date.now() + 100).toISOString() };
      renewalEntered.resolve();
      return grant.promise;
    },
  });
  const entered = Promise.withResolvers<void>(),
    release = Promise.withResolvers<void>(),
    rerun = Promise.withResolvers<void>();
  const signals: AbortSignal[] = [];
  const owner = createDocumentRelayConnection({
    ...f,
    projectId: "project",
    signal: f.controller.signal,
    synchronize: async (signal) => {
      signals.push(signal);
      entered.resolve();
      if (signals.length === 1) await release.promise;
      else rerun.resolve();
    },
  });
  try {
    await entered.promise;
    await renewalEntered.promise;
    owner.wake();
    expect(signals[0]!.aborted).toBe(false);
    grant.resolve({ token: "renewed", expiresAt: new Date(Date.now() + 60_000).toISOString() });
    await f.renewed;
    expect(signals[0]!.aborted).toBe(false);
    expect(signals).toHaveLength(1);
    release.resolve();
    await rerun.promise;
    expect(signals[1]).toBe(signals[0]);
  } finally {
    grant.resolve({ token: "cleanup", expiresAt: new Date(Date.now() + 60_000).toISOString() });
    release.resolve();
    f.controller.abort();
    await owner.done;
    await f.close();
  }
});

test("an owner retry re-registers exact work and close drains its admitted cleanup", async () => {
  const f = documentConnectionFixture();
  const foreground = Promise.withResolvers<AbortSignal>(),
    cleanup = Promise.withResolvers<void>(),
    aborted = Promise.withResolvers<void>();
  let attempts = 0;
  const owner = createDocumentRelayConnection({
    ...f,
    projectId: "project",
    signal: f.controller.signal,
    onReady: () => owner.wakeDocument("open-text"),
    synchronize: async (signal) => {
      if (!signal.aborted)
        await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
    },
    synchronizeDocument: async (_name, signal) => {
      if (++attempts === 1) throw new Error("Transient text read failure");
      foreground.resolve(signal);
      await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
      aborted.resolve();
      await cleanup.promise;
      return true;
    },
  });
  let done = false;
  void owner.done.then(() => {
    done = true;
  });
  try {
    const signal = await foreground.promise;
    expect(attempts).toBe(2);
    expect(signal.aborted).toBe(false);
    f.controller.abort();
    await aborted.promise;
    expect(done).toBe(false);
    cleanup.resolve();
    await owner.done;
    expect(done).toBe(true);
  } finally {
    cleanup.resolve();
    f.controller.abort();
    await owner.done;
    await f.close();
  }
});

test("an owner added to a connected project starts open text before its held directory", async () => {
  const f = documentConnectionFixture();
  const ready = Promise.withResolvers<void>();
  const stop = f.live.listen((event) => {
    if (event.type === "ready") ready.resolve();
  });
  await ready.promise;
  stop();
  const text = Promise.withResolvers<void>(),
    entered = Promise.withResolvers<void>(),
    release = Promise.withResolvers<void>();
  let runs = 0;
  const owner = createDocumentRelayConnection({
    ...f,
    projectId: "project",
    signal: f.controller.signal,
    onReady: () => owner.wakeDocument("already-open"),
    synchronize: async () => {
      runs++;
      entered.resolve();
      await release.promise;
    },
    synchronizeDocument: async (name) => {
      expect(name).toBe("already-open");
      text.resolve();
      return true;
    },
  });
  try {
    await text.promise;
    await entered.promise;
    expect(runs).toBe(1);
  } finally {
    release.resolve();
    f.controller.abort();
    await owner.done;
    await f.close();
  }
});

test("an owned socket calls the owner readiness hook once per protocol ready", async () => {
  const f = documentConnectionFixture();
  const entered = Promise.withResolvers<void>(),
    release = Promise.withResolvers<void>();
  let readyCalls = 0;
  const owner = createDocumentRelayConnection({
    origin: f.origin,
    projectId: "project",
    signal: f.controller.signal,
    access: f.access,
    onReady: () => {
      readyCalls++;
    },
    synchronize: async () => {
      entered.resolve();
      await release.promise;
    },
  });
  try {
    await entered.promise;
    expect(readyCalls).toBe(1);
  } finally {
    release.resolve();
    f.controller.abort();
    await owner.done;
    await f.close();
  }
});

test.each(["owner", "document"] as const)("a failed %s synchronization reports its actual cause", async (scope) => {
  const f = documentConnectionFixture();
  const cause = new Error(`Failed ${scope} synchronization`);
  const reported = Promise.withResolvers<unknown>();
  const owner = createDocumentRelayConnection({
    ...f,
    projectId: "project",
    signal: f.controller.signal,
    synchronize: async () => {
      if (scope === "owner") throw cause;
    },
    synchronizeDocument: async () => {
      throw cause;
    },
    onReady: () => {
      if (scope === "document") owner.wakeDocument("text");
    },
    onError: (error?: unknown) => reported.resolve(error),
  });
  try {
    expect(await reported.promise).toBe(cause);
  } finally {
    f.controller.abort();
    await owner.done;
    await f.close();
  }
});
