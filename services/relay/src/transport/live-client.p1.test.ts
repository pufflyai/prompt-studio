import { afterEach, expect, test } from "bun:test";
import { createSyncSpace } from "pstdio-sync/encryption";
import {
  createDeviceCommandChannel,
  createDocumentRelayConnection,
  createLiveConnection,
  type LiveConnection,
} from "pstdio-sync/relay";
import { liveProtocolHeader, liveProtocolVersion, syncPath } from "pstdio-sync-contracts";
import { defaultRelayLimits } from "../limits";
import { createLiveHub } from "./live";
import { createRateLimit } from "./rate-limit";
import type { RelaySocket } from "./sockets";

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
const topic = { spaceOwner: null, topic: "opaque_topic_123456" };
const payload = Buffer.from("ciphertext").toString("base64");
const until = async (condition: () => boolean) => {
  const end = Date.now() + 1000;
  while (!condition() && Date.now() < end) await Bun.sleep(1);
  expect(condition()).toBe(true);
};
const barrier = async (channel: LiveConnection) => {
  const received = Promise.withResolvers<void>();
  const stop = channel.listen((event) => {
    if (event.type === "subscribers") received.resolve();
  });
  const release = channel.follow(topic, () => {});
  await received.promise;
  release();
  stop();
};
const fixture = (limits = defaultRelayLimits, now = () => Date.now()) => {
  const allow = createRateLimit(limits.requestsPerSecond, limits.requestBurst, now);
  const hub = createLiveHub(limits, allow);
  let opens = 0;
  const received: { type: string; topic?: string; requestId?: string }[] = [];
  const server = Bun.serve<{ handler: RelaySocket }>({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request, server) {
      expect(request.headers.get(liveProtocolHeader)).toBe(String(liveProtocolVersion));
      const handler = hub.connect({
        projectKey: new URL(request.url).pathname,
        accountId: "owner",
        deviceId: request.headers.get("authorization")!,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      });
      if (server.upgrade(request, { data: { handler } })) return;
      return new Response(null, { status: 426 });
    },
    websocket: {
      open(socket) {
        opens++;
        socket.data.handler.open(socket);
      },
      message(socket, message) {
        received.push(JSON.parse(String(message)));
        socket.data.handler.message(message);
      },
      close(socket) {
        socket.data.handler.close();
      },
    },
  });
  cleanups.push(() => server.stop(true));
  const client = (deviceId: string, lifetime = 60_000, projectId = "project") => {
    const channel = createLiveConnection({
      origin: server.url.origin,
      projectId,
      signal: new AbortController().signal,
      access: async () => ({ token: deviceId, expiresAt: new Date(Date.now() + lifetime).toISOString() }),
    });
    cleanups.push(async () => {
      channel.close();
      await channel.done;
    });
    return channel;
  };
  return {
    hub: {
      changed: (change: Parameters<typeof hub.changed>[0]) =>
        hub.changed({ ...change, projectKey: syncPath({ kind: "live", projectId: change.projectKey }) }),
    },
    client,
    received,
    allow,
    opens: () => opens,
  };
};

test("signed private device commands cross the real relay, stream replies and reject forged callers", async () => {
  const f = fixture();
  const a = f.client("a");
  const b = f.client("b");
  const space = await createSyncSpace({
    projectId: "project",
    spaceOwner: "owner",
    keys: [
      {
        generation: 1,
        secret: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url"),
      },
    ],
  });
  const keys = new Map<string, CryptoKeyPair>();
  for (const id of ["Bearer a", "Bearer b"]) {
    const pair = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]);
    if (!("privateKey" in pair)) throw new Error("Ed25519 did not create a key pair");
    keys.set(id, pair);
  }
  const identity = (id: string) => {
    const key = keys.get(id)!.privateKey;
    return async () => ({ accountId: "owner", deviceId: id, key });
  };
  let invocations = 0;
  const source = createDeviceCommandChannel({
    live: a,
    space: async () => space,
    identity: identity("Bearer a"),
    trustedKey: async (id) => keys.get(id)!.publicKey,
    execute: async () => null,
  });
  const target = createDeviceCommandChannel({
    live: b,
    space: async () => space,
    identity: identity("Bearer b"),
    trustedKey: async (id) => keys.get(id)!.publicKey,
    execute: async (command, { partial }) => {
      invocations++;
      await partial({ progress: "private-progress" });
      return command === "read-large" ? "Private Unicode: 🦊 é\n".repeat(15_000) : command;
    },
  });
  cleanups.push(async () => {
    source.close();
    target.close();
  });
  await Promise.all([source.ready, target.ready]);
  await barrier(b);
  const partials: unknown[] = [];
  const command = { type: "session.interrupt", sessionId: "private-session" };
  expect(
    await source.call("Bearer b", command, {
      signal: new AbortController().signal,
      partial: (value) => partials.push(value),
    }),
  ).toEqual(command);
  expect(partials).toEqual([{ progress: "private-progress" }]);
  expect(invocations).toBe(1);
  const previous = (f.received as { type: string; procedure?: string; payload?: string }[])
    .filter((frame) => frame.type === "call")
    .at(-1)!;
  await expect(
    a.call({
      deviceId: "Bearer b",
      procedure: previous.procedure!,
      payload: previous.payload!,
      spaceOwner: "owner",
      signal: new AbortController().signal,
    }),
  ).rejects.toThrow("failed");
  expect(invocations).toBe(1);
  expect(JSON.stringify(f.received)).not.toContain("private-session");
  expect(JSON.stringify(f.received)).not.toContain("private-progress");
  expect(await source.call("Bearer b", "read-large", { signal: new AbortController().signal })).toBe(
    "Private Unicode: 🦊 é\n".repeat(15_000),
  );
  expect(invocations).toBe(2);
  const longPrompt = "a".repeat(100_000);
  expect(await source.call("Bearer b", { prompt: longPrompt }, { signal: new AbortController().signal })).toEqual({
    prompt: longPrompt,
  });
  expect(invocations).toBe(3);
  await expect(source.call("offline", command, { signal: new AbortController().signal })).rejects.toThrow(
    "unavailable",
  );
  const original = keys.get("Bearer a")!;
  const forged = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]);
  if (!("privateKey" in forged)) throw new Error("Ed25519 did not create a key pair");
  keys.set("Bearer a", forged);
  await expect(source.call("Bearer b", command, { signal: new AbortController().signal })).rejects.toThrow("failed");
  expect(invocations).toBe(3);
  keys.set("Bearer a", original);
});

test("many document owners share one socket and existing changes wake only the interested owner", async () => {
  const f = fixture();
  const live = f.client("desktop");
  const counts = [0, 0];
  const owners = counts.map((_, index) => {
    const controller = new AbortController();
    const connection = createDocumentRelayConnection({
      origin: "unused",
      projectId: "project",
      access: async () => {
        throw new Error("uses shared access");
      },
      signal: controller.signal,
      live,
      synchronize: async (_, subscribe) => {
        counts[index]++;
        subscribe(null, index ? "another_topic_123456" : topic.topic);
      },
    });
    cleanups.push(async () => {
      controller.abort();
      await connection.done;
    });
    return connection;
  });
  // Admission can run catch-up before this observer sees the first pass.
  await until(() => counts.every((count) => count >= 1));
  expect(f.opens()).toBe(1);
  await barrier(live);
  await until(() => owners.every((owner) => !owner.status().busy));
  const before = [...counts];
  f.hub.changed({ projectKey: "project", spaceOwner: null, documentId: topic.topic, lastSequence: 2, stateId: null });
  await until(() => counts[0] === before[0]! + 1);
  expect(counts[1]).toBe(before[1]);
  expect(owners.every((owner) => owner.status().connected)).toBe(true);
});

test("reader state and subscriptions restore after reconnect and short access renewal", async () => {
  const f = fixture();
  const sender = f.client("laptop");
  const reader = f.client("desktop", 200);
  const states: boolean[] = [];
  sender.follow(topic, (active) => states.push(active));
  const release = reader.subscribe(topic);
  await until(() => states.at(-1) === true);
  const before = Date.now();
  reader.reconnect();
  reader.retry();
  await until(() => states.slice(2).includes(false) && states.at(-1) === true);
  expect(Date.now() - before).toBeLessThan(1000);
  await until(() => f.opens() >= 4 && states.at(-1) === true);
  expect(states.at(-1)).toBe(true);
  release();
  await until(() => states.at(-1) === false);
});

test("device calls stream results, reject offline immediately, and cancel the callee", async () => {
  const f = fixture();
  const a = f.client("a");
  const b = f.client("b");
  let cancelled = false;
  b.register(topic, async (_, signal, partial) => {
    partial(payload);
    await new Promise<void>((resolve) =>
      signal.addEventListener(
        "abort",
        () => {
          cancelled = true;
          resolve();
        },
        { once: true },
      ),
    );
    return payload;
  });
  await until(() => a.status().connected && b.status().connected);
  await barrier(b);
  const controller = new AbortController();
  const partials: string[] = [];
  const call = a.call({
    deviceId: "Bearer b",
    procedure: topic.topic,
    spaceOwner: null,
    payload,
    signal: controller.signal,
    partial: (value) => partials.push(value),
  });
  const rejection = call.catch((error) => error);
  await until(() => partials.length === 1);
  controller.abort(new Error("Interrupted"));
  expect((await rejection).message).toBe("Interrupted");
  await until(() => cancelled);
  const offline = a
    .call({
      deviceId: "offline",
      procedure: topic.topic,
      spaceOwner: null,
      payload,
      signal: new AbortController().signal,
    })
    .catch((error) => error);
  expect((await offline).message).toContain("unavailable");
});

test("subscriber references release only after the last local reader leaves", async () => {
  const f = fixture();
  const a = f.client("a");
  const b = f.client("b");
  let active = false;
  a.follow(topic, (value) => {
    active = value;
  });
  const one = b.subscribe(topic);
  const two = b.subscribe(topic);
  await until(() => active);
  one();
  expect(active).toBe(true);
  two();
  await until(() => !active);
});

test("discovery wakes an owner for an unclaimed document whose first content is a latest state", async () => {
  const f = fixture();
  const live = f.client("desktop");
  const controller = new AbortController();
  let runs = 0;
  const owner = createDocumentRelayConnection({
    origin: "unused",
    projectId: "project",
    live,
    signal: controller.signal,
    access: async () => {
      throw new Error("shared access");
    },
    synchronize: async () => {
      runs++;
    },
  });
  cleanups.push(async () => {
    controller.abort();
    await owner.done;
  });
  await until(() => runs === 1);
  await barrier(live);
  f.hub.changed({
    projectKey: "project",
    spaceOwner: null,
    documentId: topic.topic,
    lastSequence: 0,
    stateId: "opaque_state_123456",
    created: true,
  });
  await until(() => runs === 2);
});

test("renewal cancels an old failing drain before starting its replacement without another reconnect", async () => {
  const f = fixture();
  const live = f.client("desktop");
  const controller = new AbortController();
  let runs = 0;
  let errors = 0;
  const owner = createDocumentRelayConnection({
    origin: "unused",
    projectId: "project",
    live,
    signal: controller.signal,
    access: async () => {
      throw new Error("shared access");
    },
    onError: () => {
      errors++;
    },
    synchronize: async (signal) => {
      if (++runs === 1)
        await new Promise<void>((_, reject) =>
          signal.addEventListener("abort", () => reject(new Error("cancelled")), { once: true }),
        );
    },
  });
  cleanups.push(async () => {
    controller.abort();
    await owner.done;
  });
  await until(() => runs === 1);
  live.reconnect();
  await until(() => runs === 2);
  expect(errors).toBe(0);
  expect(f.opens()).toBe(2);
});

test("one owner's failed sync does not reconnect the project or restart healthy owners", async () => {
  const f = fixture();
  const live = f.client("desktop");
  const controller = new AbortController();
  let failures = 0;
  let healthyRuns = 0;
  const failed = createDocumentRelayConnection({
    origin: "unused",
    projectId: "project",
    live,
    signal: controller.signal,
    access: async () => {
      throw new Error("shared access");
    },
    synchronize: async () => {
      failures++;
      throw new Error("document unavailable");
    },
  });
  const healthy = createDocumentRelayConnection({
    origin: "unused",
    projectId: "project",
    live,
    signal: controller.signal,
    access: async () => {
      throw new Error("shared access");
    },
    synchronize: async () => {
      healthyRuns++;
    },
  });
  cleanups.push(async () => {
    controller.abort();
    await Promise.all([failed.done, healthy.done]);
  });
  await until(() => failures === 1 && healthyRuns === 1);
  await barrier(live);
  expect(f.opens()).toBe(1);
  expect(healthyRuns).toBe(1);
  // Explicit owner retry must also leave the shared socket and healthy owner alone.
  failed.retry();
  await until(() => failures === 2);
  expect(f.opens()).toBe(1);
  expect(healthyRuns).toBe(1);
});

test("an unsupported live handshake exposes the update requirement and stops reconnecting", async () => {
  let requests = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch() {
      requests++;
      return Response.json(
        { error: "protocol-unsupported", supported: [1], message: "Update Prompt Studio" },
        { status: 426 },
      );
    },
  });
  cleanups.push(() => server.stop(true));
  const live = createLiveConnection({
    origin: server.url.origin,
    projectId: "project",
    signal: new AbortController().signal,
    access: async () => ({ token: "device", expiresAt: new Date(Date.now() + 60_000).toISOString() }),
  });
  cleanups.push(async () => {
    live.close();
    await live.done;
  });
  await live.done;
  expect(live.status().protocolUnsupported).toBe(true);
  expect(requests).toBe(2); // Failed upgrade, then one authenticated refusal-body probe.
});

test("an older ready version also exposes the update requirement", async () => {
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request, server) {
      if (server.upgrade(request)) return;
      return new Response(null, { status: 426 });
    },
    websocket: {
      open(socket) {
        socket.send(JSON.stringify({ type: "ready", protocolVersion: 1 }));
      },
      message() {},
    },
  });
  cleanups.push(() => server.stop(true));
  const live = createLiveConnection({
    origin: server.url.origin,
    projectId: "project",
    signal: new AbortController().signal,
    access: async () => ({ token: "device", expiresAt: new Date(Date.now() + 60_000).toISOString() }),
  });
  cleanups.push(async () => {
    live.close();
    await live.done;
  });
  await live.done;
  expect(live.status().protocolUnsupported).toBe(true);
});

test("routing state restores across projects and reconnect after the device bucket is exhausted", async () => {
  const limits = { ...defaultRelayLimits, requestsPerSecond: 200, requestBurst: 4 };
  const f = fixture(limits);
  const a = f.client("desktop");
  const b = f.client("desktop", 60_000, "another-project");
  // Document HTTP reads share this exact device bucket with both project sockets.
  while (f.allow("Bearer desktop")) {}
  const releases = Array.from({ length: 18 }, (_, index) => {
    const topic = { spaceOwner: null, topic: `opaque_topic_${String(index).padStart(6, "0")}` };
    const channel = index % 2 ? a : b;
    const release = channel.subscribe(topic);
    channel.follow(topic, () => {});
    return release;
  });
  let replies = 0;
  a.listen((event) => {
    if (event.type === "subscribers") replies++;
  });
  b.listen((event) => {
    if (event.type === "subscribers") replies++;
  });
  await until(() => replies === 18);
  expect(f.opens()).toBe(2);
  a.reconnect();
  await until(() => replies === 27);
  expect(f.opens()).toBe(3);
  for (const release of releases) release();
});

test("a reader removed while throttled is not restored after its retry window", async () => {
  const f = fixture({ ...defaultRelayLimits, requestsPerSecond: 20, requestBurst: 1 }, () => 0);
  const a = f.client("desktop");
  while (f.allow("Bearer desktop")) {}
  const release = a.subscribe(topic);
  await until(() => f.received.length === 1);
  release();
  await Bun.sleep(75);
  expect(f.received).toHaveLength(1);
  expect(f.opens()).toBe(1);
});

test("disabled live quotas report a permanent refusal instead of reconnecting", async () => {
  const f = fixture({ ...defaultRelayLimits, requestsPerSecond: 0, requestBurst: 0 });
  const a = f.client("desktop");
  a.subscribe(topic);
  await a.done;
  expect(a.status().controlRefused).toBe(true);
  expect(f.opens()).toBe(1);
});

test("an owner catches writes made between its HTTP read and delayed subscription admission", async () => {
  const f = fixture({ ...defaultRelayLimits, requestsPerSecond: 100, requestBurst: 1 });
  const live = f.client("desktop");
  const controller = new AbortController();
  let stored = 0;
  let observed = -1;
  let runs = 0;
  const owner = createDocumentRelayConnection({
    origin: "unused",
    projectId: "project",
    signal: controller.signal,
    live,
    access: async () => {
      throw new Error("shared access");
    },
    synchronize: async (_, subscribe) => {
      subscribe(null, topic.topic);
      observed = stored;
      if (++runs === 1) {
        stored = 1;
        f.hub.changed({
          projectKey: "project",
          spaceOwner: null,
          documentId: topic.topic,
          lastSequence: 1,
          stateId: null,
        });
      }
    },
  });
  cleanups.push(async () => {
    controller.abort();
    await owner.done;
  });
  await until(() => observed === 1);
  expect(runs).toBe(2);
  expect(f.opens()).toBe(1);
});
