import { readFileSync } from "node:fs";
import { join } from "node:path";

interface IsolatedRuntimeOptions {
  url: string;
  pid: number;
  home?: string;
  timeoutMs?: number;
}

export const waitForIsolatedRuntime = async (options: IsolatedRuntimeOptions) => {
  const { url, pid, home, timeoutMs = 90_000 } = options;
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    try {
      process.kill(pid, 0);
    } catch {
      throw new Error(`The isolated runtime process ${pid} exited before becoming ready.`);
    }
    try {
      const response = await fetch(`${url}/healthz`, {
        signal: AbortSignal.timeout(Math.max(1, Math.ceil(deadline - performance.now()))),
      });
      await response.body?.cancel();
      if (response.ok) {
        if (!home) return;
        const descriptor = JSON.parse(readFileSync(join(home, "runtime.json"), "utf8")) as { token?: unknown };
        if (typeof descriptor.token === "string" && descriptor.token) return descriptor.token;
      }
    } catch {
      // Health and the atomic descriptor may become available on different polls.
    }
    await Bun.sleep(Math.max(0, Math.min(1_000, deadline - performance.now())));
  }
  throw new Error(`The isolated runtime at ${url} did not become ready within ${timeoutMs}ms.`);
};

if (import.meta.main) {
  const [url, rawPid] = process.argv.slice(2);
  const pid = Number(rawPid);
  if (!url || !Number.isInteger(pid) || pid <= 0) throw new Error("Expected the runtime URL and process ID.");
  const home = process.env.PSTDIO_DESKTOP_FLOW === "1" ? process.env.PSTDIO_HOME : undefined;
  const token = await waitForIsolatedRuntime({ url, pid, home });
  if (token) process.stdout.write(token);
}
