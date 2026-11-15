import { strict as assert } from "node:assert";
import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { ScenarioCapture } from "pstdio-benchmarks/writer";
import {
  launchMemoryDesktop,
  memoryEnvironment,
  prepareMemoryExtensions,
  readMemoryRuntime,
} from "../desktop-memory-app";
import { projectActions, seedProject, wait, workbench } from "./desktop-project";

export const desktopWorkload = async (
  capture: ScenarioCapture,
  run: (value: Awaited<ReturnType<typeof context>>) => Promise<void>,
) => {
  const value = await context(capture);
  try {
    await run(value);
  } finally {
    await value.close();
  }
};
const context = async (capture: ScenarioCapture) => {
  const executable = process.env.PSTDIO_DESKTOP_EXECUTABLE;
  const sidecar = process.env.E2E_PACKAGED_BINARY_PATH;
  if (!executable || !sidecar) throw new Error("Use the actual production desktop executable and matching sidecar");
  const artifact = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
  capture.detail("artifact", {
    executable,
    executableSha256: artifact(executable),
    sidecar,
    sidecarSha256: artifact(sidecar),
  });
  const home = mkdtempSync(join(tmpdir(), `pstdio-${capture.id}-`));
  const controller = new AbortController();
  const { signal } = controller;
  const interrupted = () => controller.abort(new Error("Benchmark interrupted"));
  for (const name of ["SIGINT", "SIGTERM"] as const) process.on(name, interrupted);
  let profile: Awaited<ReturnType<typeof prepareMemoryExtensions>> | undefined;
  let app: Awaited<ReturnType<typeof launchMemoryDesktop>> | undefined;
  let desktopPid = 0;
  let warm: ReturnType<typeof spawn> | undefined;
  const closeApp = async () => {
    const previous = app;
    app = undefined;
    await previous?.close();
    if (previous)
      await wait(
        async () => {
          try {
            process.kill(previous.runtime.pid, 0);
            return false;
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
            return true;
          }
        },
        "owned runtime exit",
        signal,
      );
  };
  const launch = async () => {
    if (capture.id !== "B1" && !profile)
      profile = await prepareMemoryExtensions(join(home, "public-extensions"), signal);
    const startedAt = Date.now();
    app = await launchMemoryDesktop(executable, home, profile?.sources, signal, (pid) => {
      desktopPid = pid;
    });
    const page = await workbench(app.browser, app.runtime, signal);
    if (process.platform === "darwin") {
      // ADR 0150: direct executable launches need an owned native activation request.
      const script = `ObjC.import("AppKit"); const app=$.NSRunningApplication.runningApplicationWithProcessIdentifier(${desktopPid}); if(app.isNil() || !app.activateWithOptions(2)) throw new Error("Owned app activation refused");`;
      await promisify(execFile)("osascript", ["-l", "JavaScript", "-e", script], { signal });
    }
    return { ...app, page, startedAt };
  };
  return {
    capture,
    home,
    signal,
    executable,
    sidecar,
    launch,
    closeApp,
    desktopPid: () => desktopPid,
    runtime: () => readMemoryRuntime(home),
    seed: async () => {
      const launched = await launch();
      const fixture = await seedProject(launched.runtime, launched.page, home, signal);
      capture.detail("fixture", {
        messages: fixture.expectedMessages.length,
        file: "memory.ts",
        terminal: "idle",
        projectId: fixture.project.id,
      });
      return { ...launched, fixture, actions: projectActions(launched.runtime, launched.page, fixture) };
    },
    async startWarmRuntime() {
      warm = spawn(sidecar, ["serve", "--foreground", "--owner", "persistent", "--host", "127.0.0.1", "--port", "0"], {
        cwd: home,
        env: memoryEnvironment(home, profile?.sources),
        stdio: "ignore",
        detached: process.platform !== "win32",
      });
      let runtime: ReturnType<typeof readMemoryRuntime>;
      await wait(
        async () => {
          runtime = readMemoryRuntime(home);
          if (!runtime || runtime.pid !== warm!.pid) return false;
          return (
            (
              await fetch(`${runtime.origin}/runtime/ready`, {
                headers: { authorization: `Bearer ${runtime.token}` },
                signal,
              }).catch(() => undefined)
            )?.ok === true
          );
        },
        "owned warm runtime",
        signal,
      );
      return runtime!;
    },
    async close() {
      try {
        await closeApp();
      } finally {
        if (warm?.exitCode === null && warm.signalCode === null) warm.kill("SIGKILL");
        for (const name of ["SIGINT", "SIGTERM"] as const) process.off(name, interrupted);
        // Keep the bounded run's home with its evidence, never a shared product home.
        const evidenceHome = process.env.BENCHMARK_KEEP_HOME;
        if (evidenceHome) {
          mkdirSync(evidenceHome, { recursive: true });
          capture.detail("home", home);
        } else {
          const { rm } = await import("node:fs/promises");
          await rm(home, { recursive: true });
        }
      }
      assert(!app);
    },
  };
};
export const afterPaint = (page: import("@playwright/test").Page) =>
  page.evaluate(
    () =>
      new Promise<number>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(performance.now())))),
  );
export const input = async (page: import("@playwright/test").Page) => {
  const composer = page.locator('[data-testid="content-editable"][contenteditable="true"]:visible');
  const started = await page.evaluate(() => performance.now());
  await composer.fill("benchmark input");
  assert.equal(await composer.innerText(), "benchmark input");
  const elapsed = (await afterPaint(page)) - started;
  await composer.fill("");
  return elapsed;
};
