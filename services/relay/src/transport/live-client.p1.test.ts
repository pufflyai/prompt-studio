import { afterEach, expect, test } from "bun:test";
import { createDocumentRelayConnection, createLiveConnection, type LiveConnection } from "pstdio-sync/relay";
import { liveProtocolHeader, liveProtocolVersion } from "pstdio-sync-contracts";
import { defaultRelayLimits } from "../limits";
import { createLiveHub } from "./live";
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
const fixture = () => {
  const hub = createLiveHub(defaultRelayLimits, () => true);
  let opens = 0;
  const server = Bun.serve<{ handler: RelaySocket }>({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request, server) {
      expect(request.headers.get(liveProtocolHeader)).toBe(String(liveProtocolVersion));
      const handler = hub.connect({
        projectKey: "project",
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
        socket.data.handler.message(message);
      },
      close(socket) {
        socket.data.handler.close();
      },
    },
  });
  cleanups.push(() => server.stop(true));
  const client = (deviceId: string, lifetime = 60_000) => {
    const channel = createLiveConnection({
      origin: server.url.origin,
      projectId: "project",
      signal: new AbortController().signal,
      access: async () => ({ token: deviceId, expiresAt: new Date(Date.now() + lifetime).toISOString() }),
    });
    cleanups.push(async () => {
      channel.close();
      await channel.done;
    });
    return channel;
  };
  return { hub, client, opens: () => opens };
};

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
  await until(() => counts.every((count) => count === 1));
  expect(f.opens()).toBe(1);
  await barrier(live);
  f.hub.changed({ projectKey: "project", spaceOwner: null, documentId: topic.topic, lastSequence: 2, stateId: null });
  await until(() => counts[0] === 2);
  expect(counts[1]).toBe(1);
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
  await until(() => f.opens() >= 4);
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
