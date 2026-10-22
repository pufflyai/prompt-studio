import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import type { KernelProcessReading } from "./performance-capture";

export const createProcessObserver = (input: { executable: string; args?: string[] }) => {
  const child = spawn(input.executable, input.args ?? ["performance-observer"], {
    stdio: ["pipe", "pipe", "ignore"],
    windowsHide: true,
  });
  const lines = createInterface({ input: child.stdout });
  let closed = false;
  let pending: { resolve: (value: KernelProcessReading | null) => void; reject: (error: Error) => void } | null = null;
  const fail = () => {
    pending?.reject(new Error("Performance process observer disconnected"));
    pending = null;
  };
  const exited = new Promise<void>((resolve) => {
    child.once("close", () => {
      closed = true;
      fail();
      lines.close();
      resolve();
    });
    child.once("error", () => {
      closed = true;
      fail();
      resolve();
    });
  });
  lines.on("line", (line) => {
    try {
      pending?.resolve(JSON.parse(line));
    } catch {
      pending?.reject(new Error("Invalid performance process reading"));
    }
    pending = null;
  });
  return {
    read: (pid: number, signal: AbortSignal) => {
      signal.throwIfAborted();
      if (closed) return Promise.reject(new Error("Performance process observer is closed"));
      if (pending) return Promise.reject(new Error("A process reading is already pending"));
      const abort = () => {
        fail();
        child.kill();
      };
      signal.addEventListener("abort", abort, { once: true });
      const result = new Promise<KernelProcessReading | null>((resolve, reject) => {
        pending = { resolve, reject };
        child.stdin.write(`${pid}\n`, (error) => {
          if (error) fail();
        });
      });
      return result.finally(() => signal.removeEventListener("abort", abort));
    },
    close: async () => {
      closed = true;
      fail();
      lines.close();
      child.kill();
      await exited;
    },
  };
};
