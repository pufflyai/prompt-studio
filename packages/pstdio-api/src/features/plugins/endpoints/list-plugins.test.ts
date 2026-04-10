import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../../../app";
import { resolveTestFilesRoot } from "../../../test-utils/resolve-test-files-root";

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

describe("POST /v1/projects/:projectId/plugins/register", () => {
  test("reinstalls bundled plugins for linked repos when they are missing", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-plugin-register-test-"));
    const repoPath = join(tempRoot, "repo");
    mkdirSync(repoPath, { recursive: true });

    const { app, close } = await createApp({
      dbPath: ":memory:",
      storagePath: join(tempRoot, "storage"),
      filesRoot: resolveTestFilesRoot(),
    });

    const projRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Plugin Registration Project" }),
    });
    const proj = await projRes.json();

    await app.request(`/v1/projects/${proj.id}/repos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "test-repo", path: repoPath }),
    });

    rmSync(join(repoPath, ".pstdio", "plugins"), { recursive: true, force: true });

    const res = await app.request(`/v1/projects/${proj.id}/plugins/register`, {
      method: "POST",
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.plugins.length).toBeGreaterThan(0);
    expect(body.pluginsDir).toContain(".pstdio/plugins");
    expect(existsSync(join(repoPath, ".pstdio", "plugins", "ticket-actions.ts"))).toBe(true);

    await close();
    rmSync(tempRoot, { recursive: true, force: true });
  });
});
