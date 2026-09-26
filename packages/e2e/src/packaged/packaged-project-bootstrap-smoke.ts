import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
export const registerProjectBootstrapSmokeTest = (timeout: number) => {
  test(
    "creates an empty project with repo bootstrap artifacts and preserves it after restart",
    async () => {
      const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-packaged-serve-"));
      let child: ChildProcess | null = null;

      try {
        const started = await startPackagedServe(tempRoot);
        child = started.child;

        const createRes = await fetch(`${started.baseUrl}/v1/projects`, {
          method: "POST",
          headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
          body: JSON.stringify({ name: "packaged-serve-project" }),
        });
        expect(createRes.status).toBe(201);

        const project = (await createRes.json()) as { id: string };
        const providersRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/workspace-providers`, {
          headers: runtimeAuthorization(started.descriptor),
        });
        expect(providersRes.status).toBe(200);
        expect(await providersRes.json()).toEqual([]);
        const extensionsRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/extensions`, {
          headers: runtimeAuthorization(started.descriptor),
        });
        expect(extensionsRes.status).toBe(200);
        const extensionCatalog = (await extensionsRes.json()) as {
          marketplace: Array<{
            installName: string;
            origin: { kind: "git"; path: string; ref: string; url: string };
            publisher?: string;
          }>;
        };
        expect(extensionCatalog.marketplace).toContainEqual(
          expect.objectContaining({
            installName: "pstdio-notes",
            origin: {
              kind: "git",
              path: "extensions/pstdio-notes",
              ref: "{hostRelease}",
              url: "https://github.com/pufflyai/prompt-studio",
            },
            publisher: "pstdio",
          }),
        );
        expect(extensionCatalog.marketplace).toContainEqual(
          expect.objectContaining({
            installName: "pstdio-planner",
            origin: {
              kind: "git",
              path: "extensions/pstdio-planner",
              ref: "{hostRelease}",
              url: "https://github.com/pufflyai/prompt-studio",
            },
            publisher: "pufflyai",
          }),
        );

        const skillsRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/skills`, {
          headers: runtimeAuthorization(started.descriptor),
        });
        expect(skillsRes.status).toBe(200);

        const skills = (await skillsRes.json()) as {
          name: string;
          files: { path: string; content: string; encoding: "utf8" }[];
        }[];
        expect(skills).toEqual([]);

        const repoPath = join(tempRoot, "repo");
        const directoryRes = await fetch(`${started.baseUrl}/v1/filesystem/directories`, {
          method: "POST",
          headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
          body: JSON.stringify({ parent_path: tempRoot, name: "repo" }),
        });
        expect(directoryRes.status).toBe(201);
        expect(await directoryRes.json()).toEqual({ path: realpathSync(repoPath) });

        const repoRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/repos`, {
          method: "POST",
          headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
          body: JSON.stringify({ name: "repo", path: repoPath }),
        });
        expect(repoRes.status).toBe(201);

        expect(existsSync(join(repoPath, ".pstdio", "config.json"))).toBe(true);
        const workspaces = await fetch(`${started.baseUrl}/v1/workspaces?project_id=${project.id}`, {
          headers: runtimeAuthorization(started.descriptor),
        });
        const [rootWorkspace] = await workspaces.json();
        expect(rootWorkspace.workspace_shorthand).toBe("PSP_WS-0");
        const byReference = await fetch(`${started.baseUrl}/v1/workspaces/PSP_WS-0`, {
          headers: runtimeAuthorization(started.descriptor),
        });
        expect(byReference.status).toBe(200);
        expect((await byReference.json()).id).toBe(rootWorkspace.id);

        await stopProcess(child);
        const restarted = await startPackagedServe(tempRoot);
        child = restarted.child;
        const projectsRes = await fetch(`${restarted.baseUrl}/v1/projects`, {
          headers: runtimeAuthorization(restarted.descriptor),
        });
        expect(projectsRes.status).toBe(200);
        expect(await projectsRes.json()).toEqual([
          expect.objectContaining({ id: project.id, name: "packaged-serve-project" }),
        ]);
      } finally {
        if (child) {
          await stopProcess(child);
        }
        rmSync(tempRoot, { recursive: true, force: true });
      }
    },
    timeout,
  );
};
