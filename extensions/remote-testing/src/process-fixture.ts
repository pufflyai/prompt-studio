import type { ExtensionProcessApi } from "@pstdio/sdk/extensions";

// The host's process API, backed by real child processes for tests.
export const localProcess: ExtensionProcessApi = {
  async run(input) {
    const child = Bun.spawn(input.command, { cwd: input.cwd, env: input.env, stdout: "pipe", stderr: "pipe" });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    return { exitCode, stdout, stderr };
  },
  async runOrThrow(input) {
    const result = await localProcess.run(input);
    if (result.exitCode !== 0) throw new Error(`${input.command.join(" ")} failed: ${result.stderr}`);
    return result;
  },
  async spawnDetached() {
    throw new Error("Not used in tests");
  },
};
