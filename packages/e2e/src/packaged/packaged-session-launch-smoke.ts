import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect as expectEventually } from "@playwright/test";
import { EXTENSION_API_VERSION } from "@pstdio/sdk/extensions";
import { folderProjectInput } from "../helpers/folder-project";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

export const registerSessionLaunchSmokeTests = () => {
  test(
    "packaged extension commands return sessions before harness startup finishes",
    async () => {
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
        export default {
          harnesses: [{
            id: "worker", ref: { kind: "harness", id: "worker" }, label: "Worker",
            capabilities: () => [], listModels: () => [],
              resume() { throw new Error("Not used by the startup fixture"); },
            async start() {
              await gate.promise;
              return { agentSessionId: "accepted", done: new Promise(() => {}), stop() {} };
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
        const started = await startPackagedServe(root, {
          PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify([{ source, installName: "launch-smoke" }]),
        });
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
};
