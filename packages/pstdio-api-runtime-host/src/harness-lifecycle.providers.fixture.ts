import { resolve } from "node:path";
import { loadExtensionSources, normalizeExtensionSources } from "pstdio-extensions";
import { createEventStore } from "./event-store";
import { resolveHarnessExit } from "./harness-lifecycle";

// A fresh process gives Bun.which the fixture PATH at startup.
const [provider, operation, directory] = process.argv.slice(2);
const loaded = await loadExtensionSources({
  extensionPackages: [{ path: resolve(import.meta.dir, "../../../extensions", `harness-${provider}`) }],
});
const [record] = normalizeExtensionSources(loaded.sources, loaded.diagnostics).harnesses;
if (!record) throw new Error(JSON.stringify(loaded.diagnostics));
const events = createEventStore();
const context = { projectId: "liveness-test" } as Parameters<typeof record.provider.start>[0];
const input = {
  sessionId: "liveness-session",
  agentSessionId: "quiet-thread",
  prompt: "finish quiet work",
  cwd: directory,
  events: { push: events.push, getMessages: () => [] },
};
const session = await record.provider[operation as "start" | "resume"](context, input);
let deadline: ReturnType<typeof setTimeout> | undefined;
try {
  if (session.agentSessionId !== "quiet-thread") throw new Error("Expected the local CLI fixture");
  const exit = await Promise.race([
    resolveHarnessExit({ session, activity: events.subscribe(), timeoutMs: 25 }),
    new Promise((_, reject) => {
      deadline = setTimeout(() => reject(new Error("CLI process blocked before completing")), 2_000);
    }),
  ]);
  console.log(JSON.stringify({ exit, patches: events.getHistory() }));
} finally {
  clearTimeout(deadline);
  await session.stop();
  await session.done;
  events.close();
}
