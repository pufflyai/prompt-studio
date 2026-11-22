import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HarnessContext, HarnessEventSink } from "@pstdio/sdk/extensions";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { createInstances } from "./instances";

export async function fileTurnFixture(
  handle: (request: Request) => Response | Promise<Response>,
  options: { conversation?: boolean } = {},
) {
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const path = new URL(request.url).pathname;
      if (!options.conversation && path.includes("/conversation/open")) return Response.json({ turns: [] });
      if (!options.conversation && path.includes("/conversations/"))
        return Response.json({ items: [], next_cursor: null });
      return handle(request);
    },
  });
  const root = await mkdtemp(join(tmpdir(), "pc-file-turn-"));
  const instanceId = randomUUID(),
    machineId = randomUUID(),
    sessionId = randomUUID();
  const directory = join(root, instanceId);
  await mkdir(directory);
  await Bun.write(join(directory, "instance.json"), JSON.stringify({ id: instanceId, url: server.url.toString() }));
  await Bun.write(
    join(directory, "owner.json"),
    JSON.stringify({ token: "host-fixture", expiresAt: new Date(Date.now() + 60000).toISOString() }),
  );
  const state = createMemoryStorage();
  const ctx: HarnessContext = {
    ...makeCommandContext({
      storage: createMemoryStorage(),
      projectId: "test",
      params: {},
      overrides: { extensionId: "pocketcoder.pocketcoder" },
    }),
    name: "fixture",
    logger: console,
    state: {
      get: (key) => state.get(key),
      set: (key, value) => state.set(key, value),
      delete: (key) => state.delete(key),
    },
  };
  const instances = createInstances(root);
  const ref = { instanceId, machineId, sessionId: `${instanceId}:${machineId}`, instances };
  const events: HarnessEventSink = { getMessages: () => [], push() {} };
  const input = { sessionId, prompt: "hello", events, signal: AbortSignal.timeout(5000) };
  return {
    root,
    ctx,
    ref,
    input,
    state,
    async close() {
      await server.stop(true);
      await rm(root, { recursive: true, force: true });
    },
  };
}
