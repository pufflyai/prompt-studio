import { createServer } from "node:net";
import { type CommandRunnerEnvironment, createExtensionProcessEnvironment } from "pstdio-extensions";

const processOutput = (result: { stdout: string; stderr: string }) =>
  [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n");

export const createProcessApi = (): CommandRunnerEnvironment["process"] => {
  const api: CommandRunnerEnvironment["process"] = {
    async run(input) {
      const proc = Bun.spawn(input.command, {
        cwd: input.cwd,
        env: createExtensionProcessEnvironment(process.env, input.env),
        stderr: "pipe",
        stdout: "pipe",
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
      const proc = Bun.spawn(input.command, {
        cwd: input.cwd,
        env: createExtensionProcessEnvironment(process.env, input.env),
        stderr: "ignore",
        stdout: "ignore",
      });
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
