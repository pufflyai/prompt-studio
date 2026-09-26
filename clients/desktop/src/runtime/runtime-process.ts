import { spawn } from "node:child_process";
import { closeSync, fstatSync, mkdirSync, openSync, readSync } from "node:fs";
import { dirname } from "node:path";

const OUTPUT_LIMIT = 64 * 1024;

const readOutputTail = (path: string) => {
  const fd = openSync(path, "r");
  try {
    const size = fstatSync(fd).size;
    const output = Buffer.alloc(Math.min(size, OUTPUT_LIMIT));
    const bytes = readSync(fd, output, 0, output.length, Math.max(0, size - OUTPUT_LIMIT));
    return output.toString("utf8", 0, bytes);
  } finally {
    closeSync(fd);
  }
};

export const spawnRuntimeProcess = (
  path: string,
  args: string[],
  options: { env: NodeJS.ProcessEnv; outputPath: string },
) => {
  mkdirSync(dirname(options.outputPath), { recursive: true });
  // The runtime owns its output handle after spawn, including after desktop promotion and exit.
  // A new runtime replaces the previous launch log; diagnostics read only its bounded tail.
  const fd = openSync(options.outputPath, "w", 0o600);
  try {
    const child = spawn(path, args, {
      detached: process.platform === "win32",
      env: options.env,
      stdio: ["ignore", fd, fd],
      windowsHide: true,
    });
    return Object.assign(child, { readOutput: () => readOutputTail(options.outputPath) });
  } finally {
    closeSync(fd);
  }
};
