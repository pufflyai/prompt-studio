import { expect, test } from "bun:test";
import type { TextEditingRequest } from "pstdio-api-contracts/extension-kernel";
import { readTextDocumentSeed, seedTextDocument } from "pstdio-sync/text";
import * as Y from "yjs";
import type { GuestHost } from "./guest-host";
import { createTextEditingClient } from "./text-editing-client";
import { encodeTextBytes } from "./text-editing-codec";
import type { TextEditingSession } from "./text-editing-types";

const turn = () => new Promise<void>((resolve) => setImmediate(resolve));
const fixture = async () => {
  const document = new Y.Doc();
  await seedTextDocument(document, "source");
  const seedId = (await readTextDocumentSeed(document)).id;
  const registration = Promise.withResolvers<void>();
  const operations: string[] = [],
    listeners = new Set<(event: unknown) => void>();
  let memberId = "";
  const host = {
    async call(_method: string, input: TextEditingRequest) {
      operations.push(input.operation);
      if (input.operation === "register") {
        memberId = input.memberId;
        await registration.promise;
      }
      if (input.operation === "open")
        return {
          handle: input.memberId,
          grant: { token: "fixture" },
          snapshot: {
            state: encodeTextBytes(Y.encodeStateAsUpdate(document)),
            seedId,
            sourceSeedId: seedId,
            revision: 1,
            editable: true,
          },
        };
      if (input.operation === "project") return { revision: 1 };
    },
    onEvent(_scope: string, listener: (event: unknown) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  } as GuestHost;
  return {
    host,
    document,
    registration,
    operations,
    listeners,
    presence() {
      for (const listener of listeners)
        listener({
          type: "presence",
          memberId,
          handle: memberId,
          version: 1,
          participants: [{ id: "peer", label: "Peer", deviceName: "Other window", selection: null }],
        });
    },
  };
};

test("text-session module admission overlaps registration and preserves events buffered before its acknowledgement", async () => {
  const f = await fixture(),
    module = Promise.withResolvers<typeof import("./text-editing-session")>();
  let started = false,
    session: TextEditingSession | undefined;
  const opening = createTextEditingClient(f.host, () => {
    started = true;
    return module.promise;
  }).open({ sourceId: "body", params: {} });
  try {
    await turn();
    expect(started).toBe(true);
    expect(f.operations).toEqual(["register"]);
    f.presence();
    module.resolve(await import("./text-editing-session"));
    await turn();
    expect(f.operations).toEqual(["register"]);
    f.registration.resolve();
    session = await opening;
    expect(session.getSnapshot().text.toString()).toBe("source");
    expect(session.getSnapshot().participants.map((person) => person.id)).toEqual(["peer"]);
    await session.close();
    expect(f.listeners.size).toBe(0);
  } finally {
    f.registration.resolve();
    module.resolve(await import("./text-editing-session"));
    session ??= await opening.catch(() => undefined);
    await session?.close();
    f.document.destroy();
  }
});

test("a failed text-module load drains a late register acknowledgement before abandoning its member", async () => {
  const f = await fixture(),
    failure = new Error("Module delivery failed");
  let settled = false;
  const opening = createTextEditingClient(f.host, () => Promise.reject(failure))
    .open({ sourceId: "body", params: {} })
    .then(
      (session) => {
        settled = true;
        return session;
      },
      (error) => {
        settled = true;
        return error;
      },
    );
  try {
    await turn();
    expect(settled).toBe(false);
    expect(f.operations).toEqual(["register"]);
    f.registration.resolve();
    expect(await opening).toBe(failure);
    expect(f.operations).toEqual(["register", "abandon"]);
    expect(f.listeners.size).toBe(0);
  } finally {
    f.registration.resolve();
    const result = await opening;
    if (!(result instanceof Error)) await result.close();
    f.document.destroy();
  }
});

test("a rejected text registration observes the in-flight module and never opens an unregistered member", async () => {
  const f = await fixture(),
    module = Promise.withResolvers<typeof import("./text-editing-session")>();
  const failure = new Error("Registration rejected");
  let started = false;
  const opening = createTextEditingClient(f.host, () => {
    started = true;
    return module.promise;
  })
    .open({ sourceId: "body", params: {} })
    .catch((error) => error);
  try {
    await turn();
    f.registration.reject(failure);
    await turn();
    expect(started).toBe(true);
    module.resolve(await import("./text-editing-session"));
    expect(await opening).toBe(failure);
    expect(f.operations).toEqual(["register", "abandon"]);
    expect(f.listeners.size).toBe(0);
  } finally {
    f.registration.resolve();
    module.resolve(await import("./text-editing-session"));
    await opening;
    f.document.destroy();
  }
});
