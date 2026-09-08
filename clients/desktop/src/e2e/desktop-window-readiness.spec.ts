import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { expect, test } from "@playwright/test";

const require = createRequire(import.meta.url);

test("shows the startup window before creating the workbench view", async () => {
  const root = mkdtempSync(join(tmpdir(), "desktop-window-readiness-"));
  const server = createServer((request, response) => {
    if (request.url === "/runtime/browser-session") {
      response.setHeader(
        "set-cookie",
        "pstdio_runtime_session=window-readiness-secret; Path=/; HttpOnly; SameSite=Strict",
      );
      response.writeHead(204).end();
      return;
    }
    response.setHeader("content-type", "text/html");
    response.end("<!doctype html><main>Ready workbench</main>");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Window fixture did not bind a port");

  try {
    mkdirSync(join(root, "renderer"));
    writeFileSync(join(root, "renderer/index.html"), "<!doctype html><main>Startup progress</main>");
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
      stdio: ["pipe", "pipe", "inherit"],
    });
    const lines = createInterface({ input: application.stdout! })[Symbol.asyncIterator]();
    try {
      const beforeStartup = JSON.parse((await lines.next()).value!);
      expect(beforeStartup).toEqual({ visible: false, childViews: 0 });
      application.stdin!.write("show\n");
      const afterStartup = JSON.parse((await lines.next()).value!);
      expect(afterStartup).toEqual({ visible: true, childViews: 1 });
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
