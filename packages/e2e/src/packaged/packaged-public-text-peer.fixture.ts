import { spawn } from "node:child_process";
import { join } from "node:path";
import { createInterface } from "node:readline";
import type { StateEnvelope, StateInfo } from "pstdio-sync-contracts";
import { stopChildProcess } from "../scripts/child-process";
import { waitForProcessReady } from "../scripts/process-readiness";
import { PACKAGED_BINARY_PATH } from "./packaged-helpers";

export interface RelayContents {
  documents: [
    string,
    {
      state: { stateId: string; baseStateId: string | null; through: number } | null;
      payload?: string;
      updates: { updateId: string; payload: string; sequence: number }[];
    },
  ][];
  retainedStates: { documentId: string; stateId: string; payload: string }[];
  blobs: string[];
}

/** Use the embedded Bun already checked by packaged smoke; Node owns the test and all browsers. */
export const startPublicTextPeer = async (root: string, binaryPath = PACKAGED_BINARY_PATH) => {
  const child = spawn(binaryPath, [join(import.meta.dirname, "packaged-public-text-relay.fixture.ts"), root], {
    env: { ...process.env, BUN_BE_BUN: "1" },
    stdio: "pipe",
  });
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
  const call = (operation: string, input: object = {}, signal?: AbortSignal) =>
    new Promise<unknown>((resolve, reject) => {
      if (signal?.aborted) {
        reject(signal.reason);
        return;
      }
      const id = nextId++;
      const abort = () => {
        pending.delete(id);
        reject(signal!.reason);
      };
      signal?.addEventListener("abort", abort, { once: true });
      const finish = () => signal?.removeEventListener("abort", abort);
      pending.set(id, {
        resolve: (value) => {
          finish();
          resolve(value);
        },
        reject: (error) => {
          finish();
          reject(error);
        },
      });
      child.stdin!.write(`${JSON.stringify({ id, operation, ...input })}\n`, (error) => {
        if (!error) return;
        pending.get(id)?.reject(error);
        pending.delete(id);
      });
    });
  return {
    origin: ready!.origin,
    stop: () => call("stop"),
    restart: () => call("restart"),
    blockDevice: (deviceId: string, blocked: boolean) => call("block-device", { deviceId, blocked }),
    trim: (documentId: string) => call("trim", { documentId }),
    captureSnapshot: (documentId: string) =>
      call("capture-snapshot", { documentId }) as Promise<{
        state: StateInfo;
        payload: string;
        blobIds: string[];
        lastSequence: number;
      }>,
    installSnapshot: (documentId: string, state: StateEnvelope) => call("install-snapshot", { documentId, state }),
    inspect: (signal?: AbortSignal) => call("inspect", {}, signal) as Promise<RelayContents>,
    close: () => stopChildProcess(child),
  };
};
