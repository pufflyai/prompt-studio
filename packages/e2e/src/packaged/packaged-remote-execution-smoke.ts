import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";
import { folderProjectInput } from "../helpers/folder-project";
import { startLocalWorkspaceRegistry } from "../local-workspace-registry";
import { verifyPocketCoderLifecycle } from "./packaged-pocketcoder-lifecycle";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

const repoRoot = join(import.meta.dirname, "../../../..");

export const registerRemoteExecutionSmokeTests = () => {
  test("installs remote workspaces and runs a PocketCoder conversation through the packaged host", async () => {
    const startedAt = performance.now();
    const checkpoint = (phase: string) =>
      console.log(`[remote smoke] ${phase}: ${Math.round(performance.now() - startedAt)}ms`);
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-remote-execution-"));
    let child: ChildProcess | null = null;
    let closeRegistry: (() => Promise<void>) | null = null;

    try {
      const npmConfigPath = join(tempRoot, ".npmrc");
      const registry = await startLocalWorkspaceRegistry({
        configPath: npmConfigPath,
        outputRoot: tempRoot,
        packagePaths: [
          join(repoRoot, "packages/sdk"),
          ...["mustache", "zod"].map((name) =>
            dirname(Bun.resolveSync(`${name}/package.json`, join(repoRoot, "packages/sdk"))),
          ),
          dirname(Bun.resolveSync("typescript/package.json", join(repoRoot, "extensions/remote-workspaces"))),
        ],
      });
      closeRegistry = registry.close;
      // Install real dependencies from the checkout without public registry latency.
      appendFileSync(npmConfigPath, `registry=${registry.origin}/\n`);
      checkpoint("registry");
      const started = await startPackagedServe(tempRoot, {
        NPM_CONFIG_USERCONFIG: npmConfigPath,
        PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify({
          defaultExtensions: [{ source: join(repoRoot, "extensions/remote-workspaces") }],
        }),
      });
      child = started.child;
      checkpoint("host ready");
      const headers = runtimeAuthorization(started.descriptor);
      const projectFolder = join(tempRoot, "project");
      mkdirSync(projectFolder);
      const createRes = await fetch(`${started.baseUrl}/v1/projects`, {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify(folderProjectInput({ name: "remote-execution-project" }, projectFolder)),
      });
      checkpoint("project created");
      expect(createRes.status).toBe(201);
      const project = (await createRes.json()) as { id: string; extension_warnings?: unknown[] };
      expect(project.extension_warnings).toBeUndefined();
      expect(existsSync(join(tempRoot, "extensions/remote-workspaces/node_modules/@pstdio/sdk/package.json"))).toBe(
        true,
      );

      const metadataRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/extensions/ui`, { headers });
      expect(metadataRes.status).toBe(200);
      const metadata = (await metadataRes.json()) as WorkbenchExtensionMetadata;
      expect(metadata.connections).toContainEqual(
        expect.objectContaining({
          extensionId: "pstdio.remote-workspaces",
          localId: "pocketcoder",
          authType: "bearer",
          supportsCheck: true,
        }),
      );
      expect(metadata.harnesses).toContainEqual(
        expect.objectContaining({ id: "pstdio.remote-workspaces.harness.remote-agent" }),
      );
      expect(metadata.commands).toContainEqual(
        expect.objectContaining({ id: "pstdio.remote-workspaces.command.launch", automation: true }),
      );
      await verifyPocketCoderLifecycle(started.baseUrl, headers, project.id);
      checkpoint("conversation");
    } finally {
      if (child) await stopProcess(child);
      checkpoint("host stopped");
      if (closeRegistry) await closeRegistry();
      checkpoint("registry stopped");
      rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 30_000);
};
