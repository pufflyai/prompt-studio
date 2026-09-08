import { createServer } from "node:net";
import { type CommandRunnerEnvironment, createExtensionProcessEnvironment } from "pstdio-extensions";
import { resolveProcessCommand } from "./process-command";

type ProcessSpawner = typeof Bun.spawn;

const processOutput = (result: { stdout: string; stderr: string }) =>
  [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n");

export const createProcessApi = (spawner: ProcessSpawner = Bun.spawn): CommandRunnerEnvironment["process"] => {
  const api: CommandRunnerEnvironment["process"] = {
    async run(input) {
      const resolved = resolveProcessCommand(input.command);
      const proc = spawner(resolved.argv, {
        cwd: input.cwd,
        env: createExtensionProcessEnvironment(process.env, input.env),
        stderr: "pipe",
        stdout: "pipe",
        windowsHide: true,
        windowsVerbatimArguments: resolved.windowsVerbatimArguments,
      });
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);
      return { exitCode, stdout, stderr };
    },
    async runOrThrow(input) {
      const result = await api.run(input);
      if (result.exitCode === 0) return result;

      throw new Error(processOutput(result) || `Command failed: ${input.command.join(" ")}`);
    },
    async spawnDetached(input) {
      const resolved = resolveProcessCommand(input.command);
      const proc = spawner(resolved.argv, {
        detached: true,
        cwd: input.cwd,
        env: createExtensionProcessEnvironment(process.env, input.env),
        stderr: "ignore",
        stdin: "ignore",
        stdout: "ignore",
        windowsHide: true,
        windowsVerbatimArguments: resolved.windowsVerbatimArguments,
      });
      proc.unref();
      return { pid: proc.pid };
    },
  };

  return api;
};

export const findFreePort = (host = "127.0.0.1") =>
  new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to allocate a free port")));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
  });
