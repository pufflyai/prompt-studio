import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "@playwright/test";
import { test } from "../testing/packaged-fixture";
import { allowPageClose } from "./lifecycle-actions";
import {
  createPackagedHome,
  disposePackagedApp,
  launchPackagedApp,
  type PackagedApp,
  removePackagedHome,
  runPackagedCli,
  waitForExit,
} from "./packaged-app-helpers";
import { createPackagedProject } from "./packaged-project-helpers";

const fixturePath = dirname(
  fileURLToPath(import.meta.resolve("workbench-fixture/fixtures/detached-work/package.json")),
);
const readHeartbeat = (path: string) =>
  existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as { pid: number; tick: number }) : null;

for (const shutdown of ["desktop quit", "API shutdown"] as const) {
  test(`detached extension work survives ${shutdown}`, async () => {
    const home = createPackagedHome();
    const heartbeatPath = join(home, "detached-heartbeat.json");
    let app: PackagedApp | null = null;
    let probePid: number | undefined;
    const observations: unknown[] = [];
    const observe = (phase: string) => {
      let alive = false;
      let probeError: string | undefined;
      if (probePid) {
        try {
          process.kill(probePid, 0);
          alive = true;
        } catch (error) {
          probeError = String(error);
        }
      }
      let heartbeat: ReturnType<typeof readHeartbeat> = null;
      let heartbeatError: string | undefined;
      try {
        heartbeat = readHeartbeat(heartbeatPath);
      } catch (error) {
        heartbeatError = String(error);
      }
      observations.push({
        phase,
        time: Date.now(),
        probePid,
        alive,
        probeError,
        desktopPid: app?.child.pid,
        desktopExitCode: app?.child.exitCode,
        desktopSignal: app?.child.signalCode,
        heartbeat,
        heartbeatError,
      });
    };
    try {
      app = await launchPackagedApp(home, {
        PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify({
          defaultExtensions: [{ source: fixturePath, installName: "desktop-process-fixture" }],
        }),
      });
      const project = await createPackagedProject(app, "Detached extension work");
      const result = await app.page.evaluate(
        async ({ projectId, ...params }) => {
          const response = await fetch(
            `/v1/projects/${projectId}/extensions/commands/pstdio.desktop-process-fixture.command.spawn-detached-probe/execute`,
            {
              method: "POST",
              headers: {
                "content-type": "application/json",
                authorization: `Bearer ${localStorage.getItem("pstdio.browserSession")}`,
              },
              body: JSON.stringify({ params }),
            },
          );
          return { status: response.status, body: await response.json() };
        },
        { executable: "bun", heartbeatPath, projectId: project.id },
      );
      expect(result).toMatchObject({ status: 200, body: { outcome: { status: "success" } } });
      probePid = result.body.outcome.value.pid;
      expect(probePid).toBeGreaterThan(0);
      await expect.poll(() => readHeartbeat(heartbeatPath)?.pid).toBe(probePid);
      observe("before-shutdown");
      await app.finishTrace();
      if (shutdown === "desktop quit") {
        await allowPageClose(app.page, () => app!.page.evaluate(() => void window.promptStudioDesktop.quitApp()));
        await waitForExit(app.child);
      } else {
        const close = runPackagedCli(home, ["close"]);
        await waitForExit(app.child);
        expect(await close).toMatchObject({ exitCode: 0 });
      }
      expect(existsSync(join(home, "runtime.json"))).toBe(false);
      observe("after-shutdown");
      const tick = readHeartbeat(heartbeatPath)!.tick;
      await expect.poll(() => readHeartbeat(heartbeatPath)?.tick).toBeGreaterThan(tick);
    } finally {
      try {
        observe("before-cleanup");
        const eventsPath = `${heartbeatPath}.events`;
        await test.info().attach("detached-process-observations", {
          body: JSON.stringify({
            observations,
            events: existsSync(eventsPath) ? readFileSync(eventsPath, "utf8") : null,
          }),
          contentType: "application/json",
        });
      } finally {
        if (probePid) {
          try {
            process.kill(probePid, "SIGKILL");
          } catch {}
        }
        await disposePackagedApp(app);
        await removePackagedHome(home);
      }
    }
  });
}
