import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../app";
import { resolveTestFilesRoot } from "../test-utils/resolve-test-files-root";
import { runStartupTasks } from "./index";

let tempRoot: string;

beforeAll(() => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-startup-test-"));
});

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("runStartupTasks", () => {
  test("backfills starter plugins for already-linked repos", async () => {
    const handle = await createApp({
      dbPath: ":memory:",
      storagePath: join(tempRoot, "storage"),
      filesRoot: resolveTestFilesRoot(),
    });

    try {
      const projectRes = await handle.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Startup Plugin Project" }),
      });
      const project = await projectRes.json();

      const repoPath = join(tempRoot, "startup-plugin-repo");
      mkdirSync(repoPath, { recursive: true });

      const registerRes = await handle.app.request(`/v1/projects/${project.id}/repos`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "startup-plugin-repo", path: repoPath }),
      });
      expect(registerRes.status).toBe(201);

      const pluginsDir = join(repoPath, ".pstdio", "plugins");
      rmSync(pluginsDir, { recursive: true, force: true });
      expect(existsSync(pluginsDir)).toBe(false);

      await runStartupTasks(handle.deps);

      expect(existsSync(join(pluginsDir, "ticket-actions.ts"))).toBe(true);
    } finally {
      await handle.close();
    }
  });
});
