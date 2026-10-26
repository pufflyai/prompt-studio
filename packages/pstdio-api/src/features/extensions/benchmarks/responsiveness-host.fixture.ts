import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
import {
  disposeExtensionOwners,
  extensionPreparationPid,
  restartExtensionOwners,
  stopExtensionOwners,
} from "pstdio-extensions";
import { createTestApp } from "../../../test-utils/create-test-app";
import { subscribeExtensionCompilers } from "../extension-compiler-observations";

const root = process.argv[2]!;
const buildWebviews = process.argv[3] === "builds";
const lag = monitorEventLoopDelay({ resolution: 10 });
const compilers: Parameters<Parameters<typeof subscribeExtensionCompilers>[0]>[0][] = [];
const unsubscribe = subscribeExtensionCompilers((event) => {
  compilers.push(event);
  process.send?.({ kind: "compiler", event });
});
const handle = await createTestApp({ storageRoot: join(root, "storage"), buildWebviews });
const post = async (path: string, body: unknown) => {
  const response = await handle.app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Fixture setup failed: ${path} (${response.status})`);
  return response.json();
};
const projectPath = join(root, "project");
mkdirSync(projectPath, { recursive: true });
const project = await post("/v1/projects", {
  name: "Responsiveness fixture",
  initial_workspace: { provider_id: "pstdio.root", params: { path: projectPath } },
});
const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: handle.app.fetch });
lag.enable();
process.on("message", async (message: { id: number; kind: string }) => {
  try {
    let leakedPreparationPid: number | undefined;
    if (message.kind === "reset") {
      lag.reset();
      compilers.length = 0;
    }
    if (message.kind === "stop") await stopExtensionOwners(join(root, "extensions", "work"));
    if (message.kind === "restart") await restartExtensionOwners(join(root, "extensions", "work"));
    if (message.kind === "close") {
      await handle.close();
      leakedPreparationPid = extensionPreparationPid();
      // Keep failed benchmark trials from leaving an orphan. The driver still fails this gate.
      await disposeExtensionOwners();
      await server.stop(true);
      lag.disable();
      unsubscribe();
    }
    process.send?.({
      id: message.id,
      kind: "reply",
      value: {
        eventLoop: { resolutionMs: 10, p95Ms: lag.percentile(95) / 1e6, maxMs: lag.max / 1e6 },
        compilers: [...compilers],
        apiRssBytes: process.memoryUsage().rss,
        preparationPid: extensionPreparationPid(),
        leakedPreparationPid,
      },
    });
    if (message.kind === "close") process.disconnect?.();
  } catch (error) {
    process.send?.({ id: message.id, kind: "reply", error: error instanceof Error ? error.message : String(error) });
  }
});
process.send?.({ kind: "ready", url: server.url.origin, projectId: project.id, pid: process.pid });
