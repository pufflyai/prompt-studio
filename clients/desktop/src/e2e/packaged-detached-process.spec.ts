import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import {
  createPackagedHome,
  disposePackagedApp,
  launchPackagedApp,
  type PackagedApp,
  removePackagedHome,
  runPackagedCli,
  waitForExit,
} from "./packaged-app-helpers";

const fixturePath = resolve(import.meta.dirname, "../../../../packages/workbench-fixture");
const readHeartbeat = (path: string) =>
  existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as { pid: number; tick: number }) : null;

for (const shutdown of ["desktop quit", "API shutdown"] as const) {
  test(`detached extension work survives ${shutdown}`, async () => {
    const home = createPackagedHome();
    const heartbeatPath = join(home, "detached-heartbeat.json");
    let app: PackagedApp | null = null;
    let probePid: number | undefined;
    try {
      app = await launchPackagedApp(home, {
        PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify({
          defaultExtensions: [{ source: fixturePath, installName: "workbench-fixture" }],
        }),
      });
      const project = await app.page.evaluate(async () => {
        const response = await fetch("/v1/projects", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "Detached extension work" }),
        });
        return { status: response.status, body: await response.json() };
      });
      expect(project.status).toBe(201);
      expect(project.body.extension_warnings ?? []).toEqual([]);
      const result = await app.page.evaluate(
        async ({ projectId, ...params }) => {
          const response = await fetch(
            `/v1/projects/${projectId}/extensions/commands/pstdio.workbench-fixture.command.spawn-detached-probe/execute`,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ params }),
            },
          );
          return { status: response.status, body: await response.json() };
        },
        { executable: "bun", heartbeatPath, projectId: project.body.id },
      );
      expect(result).toMatchObject({ status: 200, body: { outcome: { status: "success" } } });
      probePid = result.body.outcome.value.pid;
      expect(probePid).toBeGreaterThan(0);
      await expect.poll(() => readHeartbeat(heartbeatPath)?.pid).toBe(probePid);
      await app.finishTrace();
      if (shutdown === "desktop quit") {
        await app.page.evaluate(() => void window.promptStudioDesktop.quitApp());
        await waitForExit(app.child);
      } else {
        const close = runPackagedCli(home, ["close"]);
        await waitForExit(app.child);
        expect(await close).toMatchObject({ exitCode: 0 });
      }
      expect(existsSync(join(home, "runtime.json"))).toBe(false);
      const tick = readHeartbeat(heartbeatPath)!.tick;
      await expect.poll(() => readHeartbeat(heartbeatPath)?.tick).toBeGreaterThan(tick);
    } finally {
      if (probePid) {
        try {
          process.kill(probePid, "SIGKILL");
        } catch {}
      }
      await disposePackagedApp(app);
      removePackagedHome(home);
    }
  });
}
