import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

interface ContainerMonitor {
  isContainerRunning: () => boolean;
  readContainerLogs: () => string;
}

export const waitForRuntimeDescriptor = async (
  pstdioHome: string,
  monitor: ContainerMonitor,
  sleep = (milliseconds: number) => Bun.sleep(milliseconds),
) => {
  const path = join(pstdioHome, "runtime.json");
  while (monitor.isContainerRunning()) {
    if (existsSync(path)) {
      try {
        const descriptor = JSON.parse(readFileSync(path, "utf8")) as { token?: unknown };
        if (typeof descriptor.token === "string" && descriptor.token) return descriptor.token;
      } catch {
        // The runtime may still be replacing the descriptor atomically.
      }
    }
    await sleep(1_000);
  }
  const logs = monitor.readContainerLogs();
  throw new Error(`The isolated desktop container stopped before publishing its runtime descriptor.\n${logs}`);
};
