import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

let executionSignal: AbortSignal | undefined;
export const setExecutionSignal = (signal?: AbortSignal) => {
  executionSignal = signal;
};
export const pause = (milliseconds: number) => delay(milliseconds, undefined, { signal: executionSignal });
export const command = (args: string[], input?: string, finishProvisioning = false) =>
  new Promise<string>((resolve, reject) => {
    const signal = finishProvisioning ? undefined : executionSignal;
    signal?.throwIfAborted();
    const child = spawn(args[0]!, args.slice(1), { stdio: ["pipe", "pipe", "pipe"], signal, timeout: 20 * 60_000 });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0)
        reject(new Error(`${args[0]} failed (${code}); ${Buffer.concat(stderr).toString().slice(-2000)}`));
      else resolve(Buffer.concat(stdout).toString());
    });
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
export const until = async <T>(name: string, read: () => Promise<T | undefined | false | null>, seconds = 180) => {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    executionSignal?.throwIfAborted();
    const value = await read();
    if (value !== undefined && value !== false && value !== null) return value;
    await pause(1000);
  }
  throw new Error(`Timed out: ${name}`);
};
