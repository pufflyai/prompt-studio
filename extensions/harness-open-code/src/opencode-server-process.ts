import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { resolveOpencodeCommand } from "./cli";

export type OpencodeServer = { url: string; dispose: () => Promise<void> };
export type OpencodeServerOptions = { host: string; port: number; signal: AbortSignal };
export type OpencodeServerStarter = (options: OpencodeServerOptions) => Promise<OpencodeServer>;

export const startOpencodeServer = async (options: OpencodeServerOptions, command = [resolveOpencodeCommand()]) => {
  const { host, port, signal } = options;
  signal.throwIfAborted();
  const [file, ...args] = command;
  const child = spawn(file!, [...args, "serve", "--hostname", host, "--port", String(port)], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    signal,
    shell: process.platform === "win32" && /\.(cmd|bat)$/i.test(file!),
  });
  const exited = new Promise<void>((resolve) => child.once("close", () => resolve()));
  let closing: Promise<void> | undefined;
  const dispose = () =>
    (closing ??= (async () => {
      if (child.exitCode === null && child.signalCode === null) child.kill();
      await exited;
    })());
  const reader = createInterface({ input: child.stdout });
  const errors = createInterface({ input: child.stderr });
  let stderrTail = "";
  errors.on("line", (line) => {
    stderrTail = `${stderrTail}\n${line}`.trim().slice(-8000);
  });
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    const url = await new Promise<string>((resolve, reject) => {
      timeout = setTimeout(
        () => reject(new Error(`Timed out waiting for Opencode server URL.\n${stderrTail}`)),
        120_000,
      );
      child.once("error", reject);
      reader.on("line", (line) => {
        const prefix = "opencode server listening on ";
        if (line.trim().startsWith(prefix)) resolve(line.trim().slice(prefix.length).trim());
      });
      reader.once("close", () => reject(new Error(`Opencode server exited before publishing its URL.\n${stderrTail}`)));
    });
    return { url, dispose };
  } catch (error) {
    await dispose();
    throw error;
  } finally {
    clearTimeout(timeout);
    reader.close();
    errors.close();
    // The server keeps logging after readiness. Drain both pipes for its whole lifetime.
    child.stdout.resume();
    child.stderr.resume();
  }
};
