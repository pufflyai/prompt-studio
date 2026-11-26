import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPreviewAdmin } from "./preview-admin";

test("reopening restores the webviews service and preserves the preview expiry", async () => {
  const workDir = await mkdtemp(join(tmpdir(), "preview-admin-"));
  const runtimePath = join(workDir, "runtime.json");
  const config = {
    workspaceId: "4feb9929-01f1-4e3e-ac7e-18ee36c7d501",
    expiresAt: Date.now() + 60_000,
    origin: "https://preview.example.test",
  };
  await Bun.write(runtimePath, JSON.stringify({ token: "fixture" }));
  await Bun.write(join(workDir, "preview.json"), JSON.stringify(config));

  const app = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: () => Response.json([{}]) });
  const gate = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: () => new Response("OK") });
  const socket = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: () => new Response() });
  const webviewsPort = socket.port!;
  await socket.stop(true);
  const source = `Bun.serve({ hostname: "127.0.0.1", port: ${webviewsPort}, fetch(request) {
    if (new URL(request.url).pathname === "/fixture/exit") setTimeout(() => process.exit(0), 10);
    return new Response(String(process.pid));
  } });`;
  const admin = createPreviewAdmin({
    workDir,
    runtimePath,
    local: app.url.origin,
    port: 0,
    services: [
      { port: gate.port!, source: undefined },
      { port: webviewsPort, source },
    ],
  });
  const prepare = () =>
    fetch(new URL("/prepare", admin.url), {
      method: "POST",
      body: JSON.stringify({ ...config, expiresAt: config.expiresAt + 10_000 }),
    });
  async function reopen() {
    for (let attempt = 0; attempt < 40; attempt++) {
      const response = await prepare();
      if (response.ok) return response.json();
      expect(response.status).toBe(425);
      await Bun.sleep(25);
    }
    throw new Error("Preview did not become ready.");
  }
  const webviews = `http://127.0.0.1:${webviewsPort}`;

  try {
    expect(await reopen()).toEqual(config);
    const first = await fetch(`${webviews}/fixture/exit`);
    const firstPid = await first.text();
    let restartedPid = firstPid;
    for (let attempt = 0; attempt < 40 && restartedPid === firstPid; attempt++) {
      expect(await reopen()).toEqual(config);
      restartedPid = await fetch(`${webviews}/__preview/health`)
        .then((response) => response.text())
        .catch(() => firstPid);
      if (restartedPid === firstPid) await Bun.sleep(25);
    }
    expect(restartedPid).not.toBe(firstPid);
  } finally {
    await admin.stop();
    await Promise.all([app.stop(true), gate.stop(true)]);
    await rm(workDir, { recursive: true, force: true });
  }
});
