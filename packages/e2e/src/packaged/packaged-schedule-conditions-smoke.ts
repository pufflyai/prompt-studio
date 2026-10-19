import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

export const registerScheduleConditionSmokeTests = () => {
  test(
    "packaged schedules follow their saved feature mode across changes and restarts",
    async () => {
      const root = mkdtempSync(join(tmpdir(), "packaged-schedule-condition-"));
      let child: ChildProcess | undefined;
      try {
        const sourcePath = join(root, "conditional-extension");
        // Yesterday's annual tick supplies catchup work without a live tick during this test.
        const yesterday = new Date(Date.now() - 24 * 60 * 60_000);
        const cron = `0 0 ${yesterday.getUTCDate()} ${yesterday.getUTCMonth() + 1} *`;
        mkdirSync(sourcePath);
        writeFileSync(
          join(sourcePath, "package.json"),
          JSON.stringify({
            name: "conditional",
            publisher: "test",
            version: "1.0.0",
            type: "module",
            main: "./extension.ts",
            engines: { pstdio: `^${EXTENSION_API_VERSION}` },
          }),
        );
        writeFileSync(
          join(sourcePath, "extension.ts"),
          `
        export default {
          commands: [
            { id: "configure", ref: { kind: "command", id: "configure" }, title: "Configure", params: { enabled: { type: "boolean", required: true } },
              async run(ctx, params) { await ctx.storage.set("mode", params); } },
            { id: "count", ref: { kind: "command", id: "count" }, title: "Count", params: {},
              async run(ctx) { return (await ctx.storage.get("count")) ?? 0; } },
            { id: "tick", ref: { kind: "command", id: "tick" }, title: "Tick", params: {},
              async run(ctx) { await ctx.storage.set("count", ((await ctx.storage.get("count")) ?? 0) + 1); } },
          ],
          schedules: [{ id: "tick", ref: { kind: "schedule", id: "tick" }, title: "Tick",
            command: { kind: "command", id: "tick" }, schedule: ${JSON.stringify(cron)},
            enabledWhen: async ({ storage }) => Boolean((await storage.get("mode"))?.enabled),
          }],
        };
      `,
        );
        let started = await startPackagedServe(root);
        child = started.child;
        const request = (path: string, body?: unknown) =>
          fetch(`${started.baseUrl}${path}`, {
            method: body === undefined ? "GET" : "POST",
            headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          });
        const response = await request("/v1/projects", folderProjectInput({ name: "conditional" }, root));
        expect(response.status).toBe(201);
        const { id: projectId } = (await response.json()) as { id: string };
        const installed = await request(`/v1/projects/${projectId}/extensions/installed/conditional/enable`, {
          displayName: "Conditional",
          extensionId: "test.conditional",
          name: "conditional",
          manifest: { name: "conditional" },
          sourceKind: "local_path",
          sourcePath,
          sourceHash: null,
          sourceRef: null,
          version: null,
        });
        expect(installed.status).toBe(200);
        const execute = async (command: string, params = {}) => {
          const response = await request(
            `/v1/projects/${projectId}/extensions/commands/test.conditional.command.${command}/execute`,
            { source: "api", params },
          );
          expect(response.status).toBe(200);
          const body = (await response.json()) as { outcome: { ok: boolean; value: unknown } };
          expect(body.outcome.ok).toBe(true);
          return body.outcome.value;
        };
        const restartWithMissedTick = async () => {
          await stopProcess(child!);
          child = undefined;
          writeFileSync(
            join(root, "storage", "extension-schedule-watermarks.json"),
            JSON.stringify({
              [`${projectId}/test.conditional.schedule.tick`]: Math.floor(Date.now() / 60_000) - 5 * 366 * 24 * 60,
            }),
          );
          started = await startPackagedServe(root);
          child = started.child;
        };
        await restartWithMissedTick();
        expect(await execute("count")).toBe(0);
        await execute("configure", { enabled: true });
        let count: unknown;
        for (let attempt = 0; attempt < 50; attempt++) {
          count = await execute("count");
          if (count === 1) break;
          await Bun.sleep(10);
        }
        expect(count).toBe(1);
        await restartWithMissedTick();
        for (let attempt = 0; attempt < 50; attempt++) {
          count = await execute("count");
          if (count === 2) break;
          await Bun.sleep(10);
        }
        expect(count).toBe(2);
        await execute("configure", { enabled: false });
        await restartWithMissedTick();
        expect(await execute("count")).toBe(2);
        expect(await (await request("/runtime/activity")).json()).toMatchObject({ jobs: [] });
      } finally {
        if (child) await stopProcess(child);
        rmSync(root, { recursive: true, force: true });
      }
    },
    PACKAGED_TEST_TIMEOUT,
  );
};
