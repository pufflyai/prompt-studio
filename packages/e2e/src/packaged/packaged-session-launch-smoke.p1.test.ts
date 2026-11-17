import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect as expectEventually } from "@playwright/test";
import { EXTENSION_API_VERSION } from "@pstdio/sdk/extensions";
import { folderProjectInput } from "../helpers/folder-project";
import { stopChildProcess } from "../scripts/child-process";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

setupPackagedSmokeTests();

test.each([false, true])(
  "packaged extension commands return sessions before harness startup finishes (restart=%s)",
  async (restart) => {
    const root = mkdtempSync(join(tmpdir(), "packaged-session-launch-"));
    let child: ChildProcess | undefined;
    try {
      const source = join(root, "extension");
      mkdirSync(source);
      writeFileSync(
        join(source, "package.json"),
        JSON.stringify({
          name: "launch-smoke",
          publisher: "test",
          version: "1.0.0",
          type: "module",
          main: "./extension.ts",
          engines: { pstdio: `^${EXTENSION_API_VERSION}` },
        }),
      );
      writeFileSync(
        join(source, "extension.ts"),
        `
        const gate = Promise.withResolvers();
        let disposed = false;
        export default {
          harnesses: [{
            id: "worker", ref: { kind: "harness", id: "worker" }, label: "Worker",
            capabilities: () => [], listModels: () => [],
            dispose() { disposed = true; gate.resolve(); },
            resume() { throw new Error("Not used by the startup fixture"); },
            async start(_ctx, input) {
              await gate.promise;
              if (disposed) throw new Error("Harness disposed before startup completed");
              return { agentSessionId: "accepted:" + input.prompt, done: new Promise(() => {}), stop() {} };
            },
          }],
          commands: [{
            id: "launch", ref: { kind: "command", id: "launch" }, title: "Launch",
            run: (ctx) => ctx.sessions.create({ title: "Slow startup", prompt: "Implement", harness: { harnessId: "test.launch-smoke.harness.worker" } }),
          }, {
            id: "release", ref: { kind: "command", id: "release" }, title: "Release",
            run() { gate.resolve(); return {}; },
          }],
        };
      `,
      );
      const env = {
        PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify([{ source, installName: "launch-smoke" }]),
      };
      let started = await startPackagedServe(root, env);
      child = started.child;
      const request = async (path: string, body?: unknown) => {
        const response = await fetch(`${started.baseUrl}/v1${path}`, {
          method: body === undefined ? "GET" : "POST",
          headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const text = await response.text();
        if (!response.ok) throw new Error(`${path}: ${response.status} ${text}`);
        return JSON.parse(text);
      };
      const folder = join(root, "project");
      mkdirSync(folder);
      const project = await request("/projects", folderProjectInput({ name: "Launch" }, folder));
      const command = (id: string) =>
        request(`/projects/${project.id}/extensions/commands/test.launch-smoke.command.${id}/execute`, {
          source: "dashboard",
        });
      let returned = false;
      const launching = command("launch").then((result) => {
        returned = true;
        return result;
      });
      try {
        await expectEventually.poll(() => returned).toBe(true);
        const result = await launching;
        expect(result.outcome).toMatchObject({ ok: true });
        expect(await request(`/sessions/${result.outcome.value.id}`)).toMatchObject({
          status: "in_progress",
          agent_session_id: null,
        });
        if (restart) {
          // Interrupt the host before startup completes. Forced API shutdown deliberately cancels active work.
          console.info("Packaged launch: stopping with harness startup pending");
          await stopChildProcess(child);
          child = undefined;
          started = await startPackagedServe(root, env);
          child = started.child;
          console.info("Packaged launch: restart ready");
          await command("release");
          await expectEventually
            .poll(() => request(`/sessions/${result.outcome.value.id}`))
            .toMatchObject({
              status: "in_progress",
              agent_session_id: "accepted:Implement",
            });
          console.info("Packaged launch: original prompt recovered");
        }
      } finally {
        await command("release");
        await launching;
      }
    } finally {
      if (child) await stopProcess(child);
      rmSync(root, { recursive: true, force: true });
    }
  },
  PACKAGED_TEST_TIMEOUT,
);
