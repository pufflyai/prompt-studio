import { expect, test } from "bun:test";
import { createDocumentRelayConnection } from "./document-connection";
import { documentConnectionFixture } from "./document-connection.test-fixture";

test("selective retry keeps a completed admitted pass instead of replaying its stale failure", async () => {
  const fixture = documentConnectionFixture();
  const ready = Promise.withResolvers<void>();
  const held = Promise.withResolvers<void>();
  let restarted = false;
  const connection = createDocumentRelayConnection({
    ...fixture,
    projectId: "project",
    signal: fixture.controller.signal,
    synchronize: async () => {
      ready.resolve();
    },
  });
  try {
    await ready.promise;
    const deadline = Date.now() + 2000;
    while (connection.status().busy && Date.now() < deadline) await Bun.sleep(5);
    expect(connection.status().busy).toBe(false);
    const pending = connection.admit(() => held.promise);
    const retry = connection.prepareRetry({
      beforeRetry: () => {
        restarted = true;
      },
    });
    held.resolve();
    await pending;
    const completed = Date.now() + 2000;
    while (connection.status().busy && Date.now() < completed) await Bun.sleep(5);
    expect(connection.status().busy).toBe(false);
    await retry();
    expect(restarted).toBe(false);
  } finally {
    held.resolve();
    fixture.controller.abort();
    await connection.done;
    await fixture.close();
  }
});

test("selective retry nudges a disconnected queued owner and retains its completion barrier", async () => {
  let accesses = 0;
  const renewal = Promise.withResolvers<{ token: string; expiresAt: string }>();
  const token = () => ({ token: "fixture", expiresAt: new Date(Date.now() + 60_000).toISOString() });
  const fixture = documentConnectionFixture({
    access: () => (++accesses === 1 ? Promise.resolve(token()) : renewal.promise),
  });
  const ready = Promise.withResolvers<void>();
  let admitted = false;
  const connection = createDocumentRelayConnection({
    ...fixture,
    projectId: "project",
    signal: fixture.controller.signal,
    synchronize: async () => {
      ready.resolve();
    },
  });
  try {
    await ready.promise;
    fixture.live.reconnect();
    const deadline = Date.now() + 2000;
    while (accesses < 2 && Date.now() < deadline) await Bun.sleep(5);
    expect(accesses).toBe(2);
    expect(connection.status().connected).toBe(false);
    await connection.restart();
    const completion = connection.prepareRetry({
      beforeRetry: () => {
        admitted = true;
      },
    })();
    expect(admitted).toBe(true);
    let complete = false;
    const finished = completion.then(() => {
      complete = true;
    });
    await Promise.resolve();
    expect(complete).toBe(false);
    renewal.resolve(token());
    await finished;
    expect(connection.status().connected).toBe(true);
  } finally {
    renewal.resolve(token());
    fixture.controller.abort();
    await connection.done;
    await fixture.close();
  }
});

const documentId = "native_document_0123456789";
const directoryId = "owner_directory_0123456789";

test("a full pass resolving after a targeted failure preserves the retry error during backoff", async () => {
  const f = documentConnectionFixture();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const reported = Promise.withResolvers<void>();
  const drained = Promise.withResolvers<void>();
  let released = false;
  const owner = createDocumentRelayConnection({
    ...f,
    projectId: "project",
    signal: f.controller.signal,
    synchronize: async () => {
      entered.resolve();
      await release.promise;
    },
    synchronizeDocument: async () => {
      throw new Error("Targeted read failed");
    },
    onError: () => reported.resolve(),
    onStatusChange: () => {
      if (released && !owner.status().busy) drained.resolve();
    },
  });
  try {
    await entered.promise;
    owner.wakeDocument("text");
    await reported.promise;
    released = true;
    release.resolve();
    await drained.promise;
    expect(owner.status()).toMatchObject({ busy: false, error: "Cloud source failed; retry scheduled" });
  } finally {
    release.resolve();
    f.controller.abort();
    await owner.done;
    await f.close();
  }
});

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
  const finishRetry = Promise.withResolvers<void>();
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
      } else {
        retried.resolve(signal);
        await finishRetry.promise;
      }
    },
  });
  try {
    const original = await entered.promise;
    let finished = false;
    const retry = owner.retry().then(() => {
      finished = true;
    });
    expect(original.aborted).toBe(true);
    const next = await retried.promise;
    expect(next).not.toBe(original);
    expect(next.aborted).toBe(false);
    expect(ready).toBe(2);
    expect(f.live.status().connected).toBe(true);
    expect(finished).toBe(false);
    finishRetry.resolve();
    await retry;
    expect(finished).toBe(true);
  } finally {
    release.resolve();
    finishRetry.resolve();
    f.controller.abort();
    await owner.done;
    await f.close();
  }
});

test("a new targeted failure completes the owner's explicit Retry", async () => {
  const f = documentConnectionFixture();
  const initialPass = Promise.withResolvers<void>();
  let ready = 0;
  let passes = 0;
  const owner = createDocumentRelayConnection({
    ...f,
    projectId: "project",
    signal: f.controller.signal,
    onReady() {
      if (++ready === 2) owner.wakeDocument("text");
    },
    async synchronize() {
      passes++;
      initialPass.resolve();
    },
    async synchronizeDocument() {
      throw new Error("The document still cannot download");
    },
  });
  try {
    await initialPass.promise;
    let completed = false;
    void owner.retry().then(() => {
      completed = true;
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(passes).toBe(1);
    expect(owner.status().error).toBe("Cloud source failed; retry scheduled");
    expect(completed).toBe(true);
  } finally {
    f.controller.abort();
    await owner.done;
    await f.close();
  }
});

test.each(["reconnect", "shutdown"] as const)("Retry waits for a disconnected owner to %s", async (outcome) => {
  const grant = Promise.withResolvers<{ token: string; expiresAt: string }>();
  const f = documentConnectionFixture({ access: () => grant.promise });
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const owner = createDocumentRelayConnection({
    ...f,
    projectId: "project",
    signal: f.controller.signal,
    async synchronize() {
      entered.resolve();
      await release.promise;
      throw new Error("The new attempt failed");
    },
  });
  try {
    let settled = false;
    const retry = owner.retry().then(() => {
      settled = true;
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(f.live.status().connected).toBe(false);
    expect(settled).toBe(false);
    if (outcome === "shutdown") f.controller.abort();
    else {
      grant.resolve({ token: "fixture", expiresAt: new Date(Date.now() + 60_000).toISOString() });
      await entered.promise;
      expect(settled).toBe(false);
      release.resolve();
    }
    await retry;
    expect(settled).toBe(true);
    if (outcome === "reconnect") expect(owner.status().error).toBe("Cloud source failed; retry scheduled");
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

test.each([
  "reconnect",
  "shutdown",
] as const)("selective retry retains work queued after its snapshot through %s", async (outcome) => {
  let accesses = 0;
  const renewal = Promise.withResolvers<{ token: string; expiresAt: string }>();
  const token = () => ({ token: "fixture", expiresAt: new Date(Date.now() + 60_000).toISOString() });
  const fixture = documentConnectionFixture({
    access: () => (++accesses === 1 ? Promise.resolve(token()) : renewal.promise),
  });
  const failed = Promise.withResolvers<void>();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let calls = 0;
  let restarted = false;
  const connection = createDocumentRelayConnection({
    ...fixture,
    projectId: "project",
    signal: fixture.controller.signal,
    synchronize: async () => {
      if (++calls === 1) throw new Error("Initial pass failed");
      entered.resolve();
      await release.promise;
    },
    onError: () => failed.resolve(),
  });
  try {
    await failed.promise;
    const retry = connection.prepareRetry({
      beforeRetry: () => {
        restarted = true;
      },
    });
    fixture.live.reconnect();
    const deadline = Date.now() + 2000;
    while (accesses < 2 && Date.now() < deadline) await Bun.sleep(5);
    expect(accesses).toBe(2);
    await connection.restart();
    let settled = false;
    const completion = retry().then(() => {
      settled = true;
    });
    await Bun.sleep(5);
    expect(settled).toBe(false);
    expect(restarted).toBe(false);
    expect(calls).toBe(1);
    if (outcome === "shutdown") {
      fixture.controller.abort();
      await connection.done;
    } else {
      renewal.resolve(token());
      await entered.promise;
      expect(settled).toBe(false);
      release.resolve();
    }
    await completion;
    expect(settled).toBe(true);
    expect(calls).toBe(outcome === "reconnect" ? 2 : 1);
  } finally {
    release.resolve();
    renewal.resolve(token());
    fixture.controller.abort();
    await connection.done;
    await fixture.close();
  }
});

test("resuming a logical owner failure queues a pass without cancelling healthy work and fences admission after close", async () => {
  const fixture = documentConnectionFixture();
  const entered = Promise.withResolvers<AbortSignal>();
  const release = Promise.withResolvers<void>();
  let calls = 0;
  let admissions = 0;
  const connection = createDocumentRelayConnection({
    ...fixture,
    projectId: "project",
    signal: fixture.controller.signal,
    synchronize: async (signal) => {
      if (++calls === 1) {
        entered.resolve(signal);
        await release.promise;
      }
    },
  });
  try {
    const active = await entered.promise;
    let settled = false;
    const completion = connection
      .resume(() => {
        admissions++;
      })
      .then(() => {
        settled = true;
      });
    expect(admissions).toBe(1);
    expect(active.aborted).toBe(false);
    expect(settled).toBe(false);
    release.resolve();
    await completion;
    expect(calls).toBe(2);
    expect(active.aborted).toBe(false);
    fixture.controller.abort();
    await connection.done;
    await connection.resume(() => {
      admissions++;
    });
    expect(admissions).toBe(1);
  } finally {
    release.resolve();
    fixture.controller.abort();
    await connection.done;
    await fixture.close();
  }
});

test("explicit Retry upgrades a non-cancelling logical resume without losing its waiter", async () => {
  const fixture = documentConnectionFixture();
  const entered = Promise.withResolvers<AbortSignal>();
  const replacement = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let calls = 0;
  const connection = createDocumentRelayConnection({
    ...fixture,
    projectId: "project",
    signal: fixture.controller.signal,
    synchronize: async (signal) => {
      if (++calls === 1) {
        entered.resolve(signal);
        await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
      } else {
        replacement.resolve();
        await release.promise;
      }
    },
  });
  try {
    const first = await entered.promise;
    let settled = false;
    const resumed = connection.resume().then(() => {
      settled = true;
    });
    const explicit = connection.retry();
    expect(first.aborted).toBe(true);
    await replacement.promise;
    expect(settled).toBe(false);
    release.resolve();
    await Promise.all([resumed, explicit]);
    expect(calls).toBe(2);
  } finally {
    release.resolve();
    fixture.controller.abort();
    await connection.done;
    await fixture.close();
  }
});

test("failure in an older pass cannot settle a logical resume queued behind it", async () => {
  const fixture = documentConnectionFixture();
  const entered = Promise.withResolvers<void>();
  const fail = Promise.withResolvers<void>();
  const failed = Promise.withResolvers<void>();
  const replacement = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let calls = 0;
  const connection = createDocumentRelayConnection({
    ...fixture,
    projectId: "project",
    signal: fixture.controller.signal,
    synchronize: async () => {
      if (++calls === 1) {
        entered.resolve();
        await fail.promise;
        throw new Error("Older pass failed");
      }
      replacement.resolve();
      await release.promise;
    },
    onError: () => failed.resolve(),
  });
  try {
    await entered.promise;
    let settled = false;
    const resumed = connection.resume().then(() => {
      settled = true;
    });
    fail.resolve();
    await failed.promise;
    await Bun.sleep(5);
    expect(settled).toBe(false);
    await replacement.promise;
    expect(settled).toBe(false);
    release.resolve();
    await resumed;
    expect(calls).toBe(2);
  } finally {
    fail.resolve();
    release.resolve();
    fixture.controller.abort();
    await connection.done;
    await fixture.close();
  }
});

test("selective retry retains an observed recovery that disconnects before its pass completes", async () => {
  let accesses = 0;
  const renewal = Promise.withResolvers<{ token: string; expiresAt: string }>();
  const token = () => ({ token: "fixture", expiresAt: new Date(Date.now() + 60_000).toISOString() });
  const fixture = documentConnectionFixture({
    access: () => (++accesses === 1 ? Promise.resolve(token()) : renewal.promise),
  });
  const failed = Promise.withResolvers<void>();
  const entered = Promise.withResolvers<AbortSignal>();
  const replacement = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let calls = 0;
  const connection = createDocumentRelayConnection({
    ...fixture,
    projectId: "project",
    signal: fixture.controller.signal,
    synchronize: async (signal) => {
      if (++calls === 1) throw new Error("Initial pass failed");
      if (calls === 2) {
        entered.resolve(signal);
        await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
      } else {
        replacement.resolve();
        await release.promise;
      }
    },
    onError: () => failed.resolve(),
  });
  try {
    await failed.promise;
    const retry = connection.prepareRetry();
    await connection.restart();
    const current = await entered.promise;
    let settled = false;
    const completion = retry().then(() => {
      settled = true;
    });
    fixture.live.reconnect();
    const deadline = Date.now() + 2000;
    while (accesses < 2 && Date.now() < deadline) await Bun.sleep(5);
    expect(accesses).toBe(2);
    expect(current.aborted).toBe(true);
    await Bun.sleep(5);
    expect(settled).toBe(false);
    renewal.resolve(token());
    await replacement.promise;
    expect(settled).toBe(false);
    release.resolve();
    await completion;
    expect(calls).toBe(3);
  } finally {
    renewal.resolve(token());
    release.resolve();
    fixture.controller.abort();
    await connection.done;
    await fixture.close();
  }
});

test("a selective observer follows an explicit Retry replacing the recovery it observed", async () => {
  const fixture = documentConnectionFixture();
  const failed = Promise.withResolvers<void>();
  const entered = Promise.withResolvers<void>();
  const replacement = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let calls = 0;
  const connection = createDocumentRelayConnection({
    ...fixture,
    projectId: "project",
    signal: fixture.controller.signal,
    synchronize: async (signal) => {
      if (++calls === 1) throw new Error("Initial pass failed");
      if (calls === 2) {
        entered.resolve();
        await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
      } else {
        replacement.resolve();
        await release.promise;
      }
    },
    onError: () => failed.resolve(),
  });
  try {
    await failed.promise;
    const retry = connection.prepareRetry();
    await connection.restart();
    await entered.promise;
    let settled = false;
    const observed = retry().then(() => {
      settled = true;
    });
    const explicit = connection.retry();
    await replacement.promise;
    await Bun.sleep(5);
    expect(settled).toBe(false);
    release.resolve();
    await Promise.all([observed, explicit]);
    expect(calls).toBe(3);
  } finally {
    release.resolve();
    fixture.controller.abort();
    await connection.done;
    await fixture.close();
  }
});
