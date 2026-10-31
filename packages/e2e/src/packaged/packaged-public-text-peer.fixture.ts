import { spawn } from "node:child_process";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { stopChildProcess } from "../scripts/child-process";
import { waitForProcessReady } from "../scripts/process-readiness";
import { PACKAGED_BINARY_PATH } from "./packaged-helpers";

interface RelayContents {
  documents: [string, { payload?: string; updates: Record<string, unknown>[] }][];
  blobs: string[];
}

/** Use the embedded Bun already checked by packaged smoke; Node owns the test and all browsers. */
export const startPublicTextPeer = async (root: string) => {
  const child = spawn(
    PACKAGED_BINARY_PATH,
    [join(import.meta.dirname, "packaged-public-text-relay.fixture.ts"), root],
    {
      env: { ...process.env, BUN_BE_BUN: "1" },
      stdio: "pipe",
    },
  );
  let ready: { origin: string } | undefined;
  let nextId = 0;
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  const lines = createInterface({ input: child.stdout! });
  lines.on("line", (line) => {
    const message = JSON.parse(line);
    if (message.type === "ready") ready = { origin: message.origin };
    else {
      const request = pending.get(message.id);
      pending.delete(message.id);
      if (message.ok) request?.resolve(message.value);
      else request?.reject(new Error(message.error));
    }
  });
  child.on("exit", () => {
    for (const request of pending.values()) request.reject(new Error("Controlled relay exited"));
    pending.clear();
    lines.close();
  });
  try {
    await waitForProcessReady(child, "Public text relay", async () => ready);
  } catch (error) {
    await stopChildProcess(child);
    throw error;
  }
  const call = (operation: string) =>
    new Promise<unknown>((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      child.stdin!.write(`${JSON.stringify({ id, operation })}\n`, (error) => {
        if (!error) return;
        pending.delete(id);
        reject(error);
      });
    });
  return {
    origin: ready!.origin,
    stop: () => call("stop"),
    restart: () => call("restart"),
    inspect: () => call("inspect") as Promise<RelayContents>,
    close: () => stopChildProcess(child),
  };
};
