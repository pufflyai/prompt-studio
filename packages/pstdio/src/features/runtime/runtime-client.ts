import { setTimeout as delay } from "node:timers/promises";
import type { RuntimeActivitySummary } from "pstdio-api/runtime";
import { createLogger } from "pstdio-logging";
import { isRuntimePidAlive, type RuntimeDescriptor, readRuntimeDescriptor } from "./runtime-descriptor";

type RuntimeFetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const runtimeRequest = (
  descriptor: RuntimeDescriptor,
  path: string,
  body: Record<string, unknown>,
  fetcher: RuntimeFetcher,
) =>
  fetcher(`${descriptor.origin}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${descriptor.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ instanceId: descriptor.instanceId, ...body }),
  });

export const promoteRuntime = async (descriptor: RuntimeDescriptor, fetcher: RuntimeFetcher = fetch) => {
  const response = await runtimeRequest(descriptor, "/runtime/promote", {}, fetcher);
  if (!response.ok) throw new Error(`Runtime ownership promotion failed with status ${response.status}`);
};

export const readRuntimeActivity = async (descriptor: RuntimeDescriptor, fetcher: RuntimeFetcher = fetch) => {
  const response = await fetcher(`${descriptor.origin}/runtime/activity`, {
    headers: { authorization: `Bearer ${descriptor.token}` },
  });
  if (!response.ok) throw new Error(`Runtime activity request failed with status ${response.status}`);
  return (await response.json()) as RuntimeActivitySummary;
};

const parseRuntimeEvent = (block: string) => {
  const data = block
    .split("\n")
    .find((line) => line.startsWith("data: "))
    ?.slice(6);
  if (!data) return null;
  try {
    return JSON.parse(data) as { type?: unknown; instanceId?: unknown };
  } catch {
    return null;
  }
};

const readRuntimeShutdown = async (descriptor: RuntimeDescriptor, fetcher: RuntimeFetcher, signal?: AbortSignal) => {
  const response = await fetcher(`${descriptor.origin}/runtime/events`, {
    headers: { authorization: `Bearer ${descriptor.token}` },
    signal,
  });
  if (!response.ok || !response.body) throw new Error(`Runtime event stream failed with status ${response.status}`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";
      for (const block of blocks) {
        const event = parseRuntimeEvent(block);
        if (event?.type === "intentional_shutdown" && event.instanceId === descriptor.instanceId) {
          return true;
        }
      }
      if (done) return false;
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
};

export const observeRuntimeShutdown = async (
  descriptor: RuntimeDescriptor,
  onShutdown: () => void,
  fetcher: RuntimeFetcher = fetch,
  signal?: AbortSignal,
) => {
  let failures = 0;
  while (!signal?.aborted) {
    let observed = false;
    try {
      observed = await readRuntimeShutdown(descriptor, fetcher, signal);
    } catch {
      if (signal?.aborted) return;
    }
    if (observed) {
      onShutdown();
      return;
    }
    failures += 1;
    if (failures === 2) {
      createLogger({ service: "pstdio", component: "runtime-events" }).error(
        { event: "runtime.events.disconnected", instanceId: descriptor.instanceId },
        "Runtime control stream disconnected repeatedly; reconnecting",
      );
    }
    await delay(Math.min(failures * 250, 5000), undefined, { signal }).catch(() => {});
  }
};

export type RuntimeShutdownResult =
  | { state: "accepted" }
  | { state: "active"; activity: RuntimeActivitySummary }
  | { state: "failed" };

export const requestRuntimeShutdown = async (
  descriptor: RuntimeDescriptor,
  force: boolean,
  fetcher: RuntimeFetcher = fetch,
): Promise<RuntimeShutdownResult> => {
  try {
    const response = await runtimeRequest(descriptor, "/runtime/shutdown", { force }, fetcher);
    if (response.status === 202) return { state: "accepted" };
    if (response.status === 409) {
      const body = (await response.json()) as { activity?: RuntimeActivitySummary; error?: string };
      if (body.error === "runtime_active" && body.activity) return { state: "active", activity: body.activity };
    }
    return { state: "failed" };
  } catch {
    return { state: "failed" };
  }
};

type WaitForRuntimeExitDeps = {
  isPidAlive: (pid: number) => boolean;
  readDescriptor: (path: string) => RuntimeDescriptor | null;
  sleep: (milliseconds: number) => Promise<void>;
};

export const waitForRuntimeExit = async (
  descriptorPath: string,
  descriptor: RuntimeDescriptor,
  overrides: Partial<WaitForRuntimeExitDeps> = {},
) => {
  const isPidAlive = overrides.isPidAlive ?? isRuntimePidAlive;
  const readDescriptor = overrides.readDescriptor ?? readRuntimeDescriptor;
  const sleep = overrides.sleep ?? Bun.sleep;

  while (true) {
    const current = readDescriptor(descriptorPath);
    const matchingDescriptor = current?.pid === descriptor.pid && current.instanceId === descriptor.instanceId;
    if (!isPidAlive(descriptor.pid) && !matchingDescriptor) return;
    await sleep(50);
  }
};
