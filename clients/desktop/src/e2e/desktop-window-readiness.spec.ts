import { spawn, spawnSync } from "node:child_process";
import { on, once } from "node:events";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const require = createRequire(import.meta.url);

test("loads the workbench after the startup window shows while lifecycle resources are still loading", async () => {
  const root = mkdtempSync(join(tmpdir(), "desktop-window-readiness-"));
  let workbenchRequests = 0;
  const server = createServer((request, response) => {
    if (request.url === "/runtime/browser-session") {
      response.setHeader(
        "set-cookie",
        "pstdio_runtime_session=window-readiness-secret; Path=/; HttpOnly; SameSite=Strict",
      );
      response.writeHead(204).end();
      return;
    }
    if (request.url === "/") workbenchRequests += 1;
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
    writeFileSync(join(root, "preload.cjs"), "");
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
    } finally {
      if (application.exitCode === null && application.signalCode === null) {
        const exited = once(application, "exit");
        application.kill("SIGTERM");
        await exited;
      }
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(root, { recursive: true, force: true });
  }
});
