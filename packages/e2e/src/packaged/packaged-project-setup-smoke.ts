import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { e2eExtensions } from "../default-extensions";
import { folderProjectInput } from "../helpers/folder-project";
// Covers composer drafts, rendered chat and idle sessions through the packaged host.
import { expectPackagedChatComposer } from "./packaged-chat-composer-smoke";
import { expectPackagedDriveDiscovery } from "./packaged-filesystem-smoke";
import { expectPackagedFolderOwnership } from "./packaged-folder-ownership";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";
import { expectPackagedWorkspaceFileLink } from "./packaged-workspace-link-smoke";

// Stable hosts use a version tag; nightlies retain their exact main commit.
const hostReleaseRef = /^(?:pstdio@\d|[0-9a-f]{40}$)/;

const expectPackagedProjectSetup = (logPath: string, projectId: string) => {
  const entries = readFileSync(logPath, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as Record<string, unknown>)
    .filter((entry) => entry.event === "runtime.setup.phase" && entry.project_id === projectId);
  for (const phase of ["project.workspace", "project.extensions", "project.provision"]) {
    const start = entries.find((entry) => entry.phase === phase && entry.state === "started");
    expect(start).toBeDefined();
    expect(entries).toContainEqual(
      expect.objectContaining({ phase, span_id: start!.span_id, state: "completed", duration_ms: expect.any(Number) }),
    );
  }
};

export const registerPackagedProjectSetupSmokeTests = () => {
  test(
    "serves the dashboard and API, hands off composer drafts, and starts idle sessions on their first message",
    async () => {
      const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-packaged-serve-"));
      let child: ChildProcess | null = null;

      try {
        const started = await startPackagedServe(tempRoot, {
          PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions("workbench-fixture"),
        });
        child = started.child;

        const dashboardRes = await fetch(started.baseUrl);
        expect(dashboardRes.status).toBe(200);
        expect(dashboardRes.headers.get("content-type")).toContain("text/html");
        const dashboardHtml = await dashboardRes.text();
        const moduleScript = dashboardHtml.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/);
        expect(moduleScript).not.toBeNull();
        const dashboardScript = await fetch(new URL(moduleScript![1]!, started.baseUrl));
        expect(dashboardScript.status).toBe(200);
        expect(dashboardScript.headers.get("content-type")).toMatch(/javascript/);

        const projectsRes = await fetch(`${started.baseUrl}/v1/projects`, {
          headers: runtimeAuthorization(started.descriptor),
        });
        expect(projectsRes.status).toBe(200);
        expect(await projectsRes.json()).toEqual([]);
        await expectPackagedDriveDiscovery(started.baseUrl, runtimeAuthorization(started.descriptor));
        const renameRes = await fetch(`${started.baseUrl}/v1/sessions/missing/title`, {
          method: "PATCH",
          headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
          body: JSON.stringify({ title: " " }),
        });
        expect(renameRes.status).toBe(400);
        await expectPackagedChatComposer(started.baseUrl, runtimeAuthorization(started.descriptor), tempRoot);
      } finally {
        if (child) {
          await stopProcess(child);
        }
        rmSync(tempRoot, { recursive: true, force: true });
      }
    },
    PACKAGED_TEST_TIMEOUT,
  );

  test(
    "opens an empty folder with project bootstrap artifacts and preserves it after restart",
    async () => {
      const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-packaged-serve-"));
      let child: ChildProcess | null = null;

      try {
        const logPath = join(tempRoot, "runtime.log");
        const started = await startPackagedServe(tempRoot, { PSTDIO_LOG_PATH: logPath });
        child = started.child;

        const repoPath = join(tempRoot, "project-folder");
        mkdirSync(repoPath, { recursive: true });
        const createRes = await fetch(`${started.baseUrl}/v1/projects`, {
          method: "POST",
          headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
          body: JSON.stringify(folderProjectInput({ name: "packaged-serve-project" }, repoPath)),
        });
        expect(createRes.status).toBe(201);

        const project = (await createRes.json()) as { id: string };
        expectPackagedProjectSetup(logPath, project.id);
        await expectPackagedWorkspaceFileLink({
          baseUrl: started.baseUrl,
          projectId: project.id,
          projectRoot: repoPath,
          home: tempRoot,
          headers: runtimeAuthorization(started.descriptor),
        });
        const providersRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/workspace-providers`, {
          headers: runtimeAuthorization(started.descriptor),
        });
        expect(providersRes.status).toBe(200);
        expect(await providersRes.json()).toEqual([]);
        const invalidWorkspace = await fetch(`${started.baseUrl}/v1/workspaces`, {
          method: "POST",
          headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
          body: JSON.stringify({ project_id: project.id, provider_id: "pstdio.root", params: { typo: true } }),
        });
        expect(invalidWorkspace.status).toBe(400);
        expect((await invalidWorkspace.json()).error).toContain("typo");
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
            installName: "pstdio-artifacts",
            installed: false,
            origin: {
              kind: "git",
              path: "extensions/pstdio-artifacts",
              ref: expect.stringMatching(hostReleaseRef),
              url: "https://github.com/pufflyai/prompt-studio",
            },
            publisher: "pstdio",
          }),
        );
        expect(extensionCatalog.marketplace).toContainEqual(
          expect.objectContaining({
            installName: "pstdio-notes",
            origin: {
              kind: "git",
              path: "extensions/pstdio-notes",
              ref: expect.stringMatching(hostReleaseRef),
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
              ref: expect.stringMatching(hostReleaseRef),
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

        expect(existsSync(join(repoPath, ".pstdio", "config.json"))).toBe(true);

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
        await expectPackagedFolderOwnership(restarted.baseUrl, runtimeAuthorization(restarted.descriptor), tempRoot);
        const deleted = await fetch(`${restarted.baseUrl}/v1/projects/${project.id}`, {
          method: "DELETE",
          headers: runtimeAuthorization(restarted.descriptor),
        });
        expect(deleted.status).toBe(204);
        expect(existsSync(repoPath)).toBe(true);
        expect(existsSync(join(repoPath, ".pstdio/config.json"))).toBe(false);
      } finally {
        if (child) {
          await stopProcess(child);
        }
        rmSync(tempRoot, { recursive: true, force: true });
      }
    },
    PACKAGED_TEST_TIMEOUT,
  );
};
