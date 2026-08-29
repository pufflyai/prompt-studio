import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { topLevelCommandModules } from "./adapters/cli/commands";

test("built-in command help does not start extension routing", () => {
  const repositoryRoot = resolve(import.meta.dir, "../../..");
  const cliEntry = join(import.meta.dir, "index.ts");
  const pstdioHome = mkdtempSync(join(tmpdir(), "pstdio-core-command-help-"));

  for (const commandModule of topLevelCommandModules) {
    const commandName = commandModule.command.split(" ")[0];
    const result = Bun.spawnSync({
      cmd: [process.execPath, cliEntry, commandName, "--help"],
      cwd: repositoryRoot,
      env: {
        ...process.env,
        PSTDIO_API_URL: "http://127.0.0.1:1",
        PSTDIO_DISABLE_API_AUTO_START: "1",
        PSTDIO_DISABLE_EMBED_MANIFEST: "1",
        PSTDIO_HOME: pstdioHome,
      },
      stderr: "pipe",
      stdout: "pipe",
    });
    const output = `${result.stdout.toString()}${result.stderr.toString()}`;

    expect(result.exitCode).toBe(0);
    expect(output).not.toContain("API auto-start failed");
  }
});
