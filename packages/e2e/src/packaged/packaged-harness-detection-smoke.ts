import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

export const registerHarnessDetectionSmokeTests = () => {
  test(
    "packaged host records successful process probes and failed provider detection",
    async () => {
      const root = mkdtempSync(join(tmpdir(), "packaged-detection-diagnostics-"));
      const logPath = join(root, "logs.jsonl");
      let child: ChildProcess | undefined;
      try {
        const source = join(root, "probe-extension");
        mkdirSync(source);
        writeFileSync(
          join(source, "package.json"),
          JSON.stringify({
            name: "probe-extension",
            publisher: "test",
            version: "1.0.0",
            type: "module",
            main: "./extension.ts",
            engines: { pstdio: `^${EXTENSION_API_VERSION}` },
          }),
        );
        writeFileSync(
          join(source, "extension.ts"),
          `const run = () => ({ done: Promise.resolve({ status: "completed" }), stop() {} });
         const probe = (id, detect) => ({ id, ref: { kind: "harness", id }, label: id,
           capabilities: () => [], start: run, resume: run, detect });
         export default { harnesses: [
           probe("healthy", async (ctx) => {
             const result = await ctx.process.run({ command: [process.execPath, "--version"] });
             return { available: result.exitCode === 0 };
           }),
           probe("broken", () => { throw new Error("private-probe-error"); }),
         ] };`,
        );
        const started = await startPackagedServe(root, {
          PSTDIO_LOG_LEVEL: "info",
          PSTDIO_LOG_PATH: logPath,
          PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify({
            defaultExtensions: [{ installName: "probe-extension", source, skipInstall: true }],
          }),
        });
        child = started.child;
        const projectPath = join(root, "project");
        mkdirSync(projectPath);
        const project = await fetch(`${started.baseUrl}/v1/projects`, {
          method: "POST",
          headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
          body: JSON.stringify(folderProjectInput({ name: "Detection" }, projectPath)),
        });
        expect(project.status).toBe(201);
        const response = await fetch(`${started.baseUrl}/v1/agents/info`, {
          headers: runtimeAuthorization(started.descriptor),
        });
        expect(response.status).toBe(200);
        const agents = (await response.json()) as Array<{ name: string; availability: { type: string } }>;
        expect(agents).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "healthy", availability: { type: "INSTALLED" } }),
            expect.objectContaining({ name: "broken", availability: expect.objectContaining({ type: "NOT_FOUND" }) }),
          ]),
        );
        const log = readFileSync(logPath, "utf8");
        const entries = log
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line));
        const phases = entries.filter((entry) => entry.event === "harness.detection.phase");
        expect(
          phases.filter((entry) => entry.harness_id === "healthy").map((entry) => [entry.phase, entry.state]),
        ).toEqual([
          ["provider", "started"],
          ["process.run", "started"],
          ["process.run", "completed"],
          ["provider", "completed"],
        ]);
        expect(entries).toContainEqual(
          expect.objectContaining({
            event: "harness.detection.failed",
            harness_id: "broken",
            failure: "provider_error",
          }),
        );
        expect(JSON.stringify(phases)).not.toContain("--version");
        expect(log).not.toContain("private-probe-error");
      } finally {
        if (child) await stopProcess(child);
        rmSync(root, { recursive: true, force: true });
      }
    },
    PACKAGED_TEST_TIMEOUT,
  );
};
