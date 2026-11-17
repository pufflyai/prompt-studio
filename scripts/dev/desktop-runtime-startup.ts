import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

interface ContainerMonitor {
  isContainerRunning: () => boolean;
  readContainerLogs: () => string;
}

export const readRuntimeToken = (pstdioHome: string) => {
  const path = join(pstdioHome, "runtime.json");
  if (!existsSync(path)) return undefined;
  try {
    const descriptor = JSON.parse(readFileSync(path, "utf8")) as { token?: unknown };
    return typeof descriptor.token === "string" && descriptor.token ? descriptor.token : undefined;
  } catch {
    // The runtime may still be replacing the descriptor atomically.
    return undefined;
  }
};

export const waitForRuntimeDescriptor = async (
  pstdioHome: string,
  monitor: ContainerMonitor,
  sleep = (milliseconds: number) => Bun.sleep(milliseconds),
) => {
  while (monitor.isContainerRunning()) {
    const token = readRuntimeToken(pstdioHome);
    if (token) return token;
    await sleep(1_000);
  }
  const logs = monitor.readContainerLogs();
  throw new Error(`The isolated desktop container stopped before publishing its runtime descriptor.\n${logs}`);
};
