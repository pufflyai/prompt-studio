import { spawn, spawnSync } from "node:child_process";
import { on, once } from "node:events";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { removeTestDirectory } from "../testing/remove-test-directory";

const require = createRequire(import.meta.url);

test("loads the workbench after the startup window shows while lifecycle resources are still loading", async () => {
  const root = mkdtempSync(join(tmpdir(), "desktop-window-readiness-"));
  let workbenchRequests = 0;
  let loginRequests = 0;
  const server = createServer((request, response) => {
    if (request.url === "/runtime/browser-login") {
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({ url: `http://${request.headers.host}/?login=${++loginRequests}#browser-login=fixture-code` }),
      );
      return;
    }
    if (new URL(request.url ?? "/", "http://localhost").pathname === "/") workbenchRequests += 1;
    response.setHeader("content-type", "text/html");
    response.end("<!doctype html><main>Ready workbench</main>");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Window fixture did not bind a port");

  try {
    mkdirSync(join(root, "renderer"));
    writeFileSync(
      join(root, "renderer/index.html"),
      '<!doctype html><main>Startup progress</main><img src="pending.png">',
    );
    const preload = spawnSync("bun", [
      "build",
      join(import.meta.dirname, "startup-paint-preload-fixture.ts"),
      "--outfile",
      join(root, "preload.cjs"),
      "--target=node",
      "--format=cjs",
      "--external=electron",
    ]);
    expect(preload.status, preload.stderr.toString()).toBe(0);
    const entry = join(root, "main.mjs");
    const build = spawnSync("bun", [
      "build",
      join(import.meta.dirname, "window-readiness-fixture.ts"),
      "--outfile",
      entry,
      "--target=node",
      "--format=esm",
      "--external=electron",
    ]);
    expect(build.status, build.stderr.toString()).toBe(0);
    const env = Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
    );
    delete env.ELECTRON_RUN_AS_NODE;
    const application = spawn(require("electron") as string, [entry, `--user-data-dir=${join(root, "profile")}`], {
      env: { ...env, PSTDIO_WINDOW_TEST_ORIGIN: `http://127.0.0.1:${address.port}` },
      stdio: ["ignore", "inherit", "inherit", "ipc"],
    });
    const messages = on(application, "message");
    try {
      const [beforeStartup] = await test.step("receive initial window state", async () =>
        (await messages.next()).value!);
      expect(beforeStartup).toEqual({ visible: false, workbenchVisible: false, workbenchCreated: false });
      application.send("show");
      const [documentReady] = await test.step("receive document-ready state", async () =>
        (await messages.next()).value!);
      expect(documentReady).toEqual({ documentReadyVisible: true });
      const [paintReady] = (await messages.next()).value!;
      expect(paintReady).toEqual({ paintReady: true });
      expect(workbenchRequests).toBe(0);
      application.send("release-paint");
      await expect.poll(() => workbenchRequests).toBe(1);
      const [lifecycleShown] = await test.step("receive lifecycle-visible state", async () =>
        (await messages.next()).value!);
      expect(lifecycleShown).toEqual({ lifecycleVisible: true });
      const [afterStartup] = await test.step("receive workbench-visible state", async () =>
        (await messages.next()).value!);
      expect(afterStartup).toEqual({ visible: true, workbenchVisible: true });
      await expect
        .poll(async () => {
          application.send("focus");
          return (await messages.next()).value![0];
        })
        .toEqual({ workbenchFocused: true });
      application.send("background-recovery");
      const [recovery] = await test.step("reveal recovery from a throttled lifecycle renderer", async () =>
        (await messages.next()).value!);
      expect(recovery).toEqual({ lifecycleThrottled: false });
      for (const [action, expected] of [
        ["hide", { visible: false, minimized: false, throttled: true }],
        ["show", { visible: true, minimized: false, throttled: false }],
        ["minimize", { visible: false, minimized: true, throttled: true }],
        ["restore", { visible: true, minimized: false, throttled: false }],
      ] as const) {
        await test.step(`preserve recovery paint policy after ${action}`, async () => {
          application.send(`recovery-${action}`);
          await messages.next();
          await expect
            .poll(async () => {
              application.send("recovery-state");
              return (await messages.next()).value![0];
            })
            .toEqual(expected);
        });
      }
      const beforeReload = workbenchRequests;
      application.send("reload-lifecycle");
      const [reloadPaintReady] = (await messages.next()).value!;
      expect(reloadPaintReady).toEqual({ paintReady: true });
      expect(workbenchRequests).toBe(beforeReload);
      application.send("release-paint");
      const [reloaded] = (await messages.next()).value!;
      expect(reloaded).toEqual({ lifecycleReloaded: true });
      expect(workbenchRequests).toBe(beforeReload + 1);
    } finally {
      if (application.exitCode === null && application.signalCode === null) {
        const exited = once(application, "exit");
        application.kill("SIGTERM");
        await exited;
      }
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await removeTestDirectory(root);
  }
});
