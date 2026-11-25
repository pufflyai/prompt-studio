import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isProcessGroupAlive } from "pstdio-paths";
import type { SpawnOwnedCommand } from "./preparation-command";

export interface BundleCommandInput {
  argv: string[];
  env: NodeJS.ProcessEnv;
  stdin: string;
  deadlineMs: number;
}

export type BundleOutcome = { kind: "bundle-result"; ok: true } | { kind: "bundle-result"; ok: false; error: string };

// Keep diagnostics bounded even if a macro floods a stream or leaves its pipe open.
const CLEANUP_GRACE_MS = 1_000;
const OUTPUT_TAIL_BYTES = 64 * 1024;

const isBundleOutcome = (value: unknown): value is BundleOutcome =>
  typeof value === "object" &&
  value !== null &&
  "kind" in value &&
  value.kind === "bundle-result" &&
  "ok" in value &&
  (value.ok === true || (value.ok === false && "error" in value && typeof value.error === "string"));

const readTail = (stream: ReadableStream<Uint8Array>) => {
  const reader = stream.getReader();
  let kept = new Uint8Array(0);
  const finished = (async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      const merged = new Uint8Array(kept.length + value.length);
      merged.set(kept);
      merged.set(value, kept.length);
      kept = merged.length > OUTPUT_TAIL_BYTES ? merged.slice(merged.length - OUTPUT_TAIL_BYTES) : merged;
    }
  })().catch(() => {});
  return {
    finished,
    cancel: () => void reader.cancel().catch(() => {}),
    text: () => new TextDecoder().decode(kept),
  };
};

export const captureBundleCommand = async (input: BundleCommandInput, spawn: SpawnOwnedCommand) => {
  // The prep host owns this folder so a worker can stop without leaving it behind.
  const cwd = await mkdtemp(join(tmpdir(), "pstdio-bundle-"));
  try {
    const reported = Promise.withResolvers<BundleOutcome>();
    const { child, stop } = spawn(input.argv, {
      cwd,
      env: input.env,
      stdin: new Blob([input.stdin]),
      stdout: "pipe",
      stderr: "pipe",
      ipc(message: unknown) {
        if (isBundleOutcome(message)) reported.resolve(message);
      },
    });
    const output = readTail(child.stdout);
    const errorOutput = readTail(child.stderr);
    let timedOut = false;
    const expired = Promise.withResolvers<undefined>();
    const deadline = setTimeout(() => {
      timedOut = true;
      expired.resolve(undefined);
    }, input.deadlineMs);
    try {
      // Taskkill needs the live bundler PID to find its descendants on Windows.
      const outcome = await Promise.race([
        reported.promise,
        child.exited.then(() => undefined),
        expired.promise,
      ]).finally(stop);
      const cleanupDeadline = performance.now() + CLEANUP_GRACE_MS;
      while (process.platform !== "win32" && isProcessGroupAlive(child.pid)) {
        if (performance.now() >= cleanupDeadline)
          throw new Error("The extension bundler's process group did not stop.");
        await Bun.sleep(20);
      }
      await Promise.race([
        Promise.all([output.finished, errorOutput.finished]),
        Bun.sleep(Math.max(0, cleanupDeadline - performance.now())),
      ]);
      return { exitCode: await child.exited, stdout: output.text(), stderr: errorOutput.text(), outcome, timedOut };
    } finally {
      clearTimeout(deadline);
      output.cancel();
      errorOutput.cancel();
    }
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
};
