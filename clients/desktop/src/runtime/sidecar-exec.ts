// Temporary workaround for descriptors opened by Chromium without close-on-exec.
// See ADR 0076. Replacing the bootstrap keeps ownership and cancellation of each sidecar on one PID.
const bootstrap = `
const { readdirSync } = require("node:fs");
const { dlopen } = require("bun:ffi");
const libc = dlopen("libc.so.6", { fcntl: { args: ["int", "int", "int"], returns: "int" } });
try {
  for (const entry of readdirSync("/proc/self/fd")) {
    const fd = Number(entry);
    if (fd <= 2) continue;
    const flags = libc.symbols.fcntl(fd, 1, 0);
    if (flags < 0) continue;
    if (libc.symbols.fcntl(fd, 2, flags | 1) < 0) throw new Error("Cannot isolate runtime descriptor " + fd);
  }
} finally {
  libc.close();
}
const env = { ...process.env };
delete env.BUN_BE_BUN;
process.execve(process.execPath, [process.execPath, ...process.argv.slice(1)], env);
`;

export const sidecarExec = (args: string[], env: NodeJS.ProcessEnv) => {
  if (process.platform !== "linux") return { args, env };
  return { args: ["--eval", bootstrap, "--", ...args], env: { ...env, BUN_BE_BUN: "1" } };
};
