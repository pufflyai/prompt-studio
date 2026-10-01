import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";

// The real extension entry points run local CLI fixtures, without model requests.
describe.skipIf(process.platform === "win32")("CLI harness process liveness", () => {
  const directory = mkdtempSync(join(tmpdir(), "pstdio-harness-liveness-"));

  beforeAll(async () => {
    const fixture = resolve(import.meta.dir, "harness-lifecycle.cli.fixture.ts");
    for (const command of ["claude", "codex"]) {
      const binary = join(directory, command);
      writeFileSync(binary, `#!/bin/sh\nexec '${process.execPath}' '${fixture}' '${command}'\n`);
      chmodSync(binary, 0o755);
    }
  });

  afterAll(() => rmSync(directory, { recursive: true, force: true }));

  for (const provider of ["claude-code", "codex"]) {
    for (const operation of ["start", "resume"] as const) {
      for (const scenario of ["quiet work", "stderr backpressure", "process failure"]) {
        test(`${provider} ${operation} preserves ${scenario}`, async () => {
          const child = Bun.spawn(
            [
              process.execPath,
              resolve(import.meta.dir, "harness-lifecycle.providers.fixture.ts"),
              provider,
              operation,
              directory,
            ],
            {
              env: {
                ...process.env,
                PATH: `${directory}${delimiter}${process.env.PATH}`,
                LIVENESS_STDERR: scenario === "stderr backpressure" ? "1" : "",
                LIVENESS_EXIT_CODE: scenario === "process failure" ? "1" : "0",
              },
              stdout: "pipe",
              stderr: "pipe",
            },
          );
          const [code, stdout, stderr] = await Promise.all([
            child.exited,
            new Response(child.stdout).text(),
            new Response(child.stderr).text(),
          ]);
          expect({ code, stderr }).toEqual({ code: 0, stderr: "" });
          const result = JSON.parse(stdout);
          expect(result.exit).toEqual({ status: scenario === "process failure" ? "failed" : "completed" });
          expect(JSON.stringify(result.patches)).toContain("quiet work completed");
        });
      }
    }
  }
});
