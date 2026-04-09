import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../../../app";

describe("GET /v1/projects/:projectId/plugins", () => {
  test("returns empty array when no plugins exist", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-plugins-test-"));

    const { app, close } = await createApp({
      dbPath: ":memory:",
      storagePath: join(tempRoot, "storage"),
      filesRoot: "",
    });

    const projRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Empty Plugins Project" }),
    });
    const proj = await projRes.json();

    const res = await app.request(`/v1/projects/${proj.id}/plugins`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.plugins).toEqual([]);
    expect(body.pluginsDir).toBeNull();

    await close();
    rmSync(tempRoot, { recursive: true, force: true });
  });

  test("returns loaded plugins with their identity and file path", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-plugins-test2-"));
    const repoPath = join(tempRoot, "repo");
    const pluginsDir = join(repoPath, ".pstdio", "plugins");
    mkdirSync(pluginsDir, { recursive: true });
    writeFileSync(
      join(pluginsDir, "hello-plugin.ts"),
      `export default { actions: [{ key: "greet", label: "Greet", targetType: "ticket", placement: "primary", trigger() {} }] };`,
    );

    const { app, close } = await createApp({
      dbPath: ":memory:",
      storagePath: join(tempRoot, "storage"),
      filesRoot: "",
    });

    const projRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Plugins Project" }),
    });
    const proj = await projRes.json();

    await app.request(`/v1/projects/${proj.id}/repos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "test-repo", path: repoPath }),
    });

    const res = await app.request(`/v1/projects/${proj.id}/plugins`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.plugins).toHaveLength(1);
    expect(body.plugins[0].identity).toBe("hello-plugin");
    expect(body.plugins[0].filePath).toContain("hello-plugin.ts");
    expect(body.pluginsDir).toContain(".pstdio/plugins");

    await close();
    rmSync(tempRoot, { recursive: true, force: true });
  });
});
