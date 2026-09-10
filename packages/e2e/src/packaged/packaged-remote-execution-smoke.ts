import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";
import { startLocalWorkspaceRegistry } from "../local-workspace-registry";
import { verifyPocketCoderLifecycle } from "./packaged-pocketcoder-lifecycle";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

const repoRoot = join(import.meta.dirname, "../../../..");

export const registerRemoteExecutionSmokeTests = () => {
  test("installs remote workspaces and runs a PocketCoder conversation through the packaged host", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-remote-execution-"));
    let child: ChildProcess | null = null;
    let closeRegistry: (() => Promise<void>) | null = null;

    try {
      const npmConfigPath = join(tempRoot, ".npmrc");
      const registry = await startLocalWorkspaceRegistry({
        configPath: npmConfigPath,
        outputRoot: tempRoot,
        packagePaths: [join(repoRoot, "packages/sdk")],
      });
      closeRegistry = registry.close;
      const started = await startPackagedServe(tempRoot, {
        NPM_CONFIG_USERCONFIG: npmConfigPath,
        PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify({
          defaultExtensions: [{ source: join(repoRoot, "extensions/remote-workspaces") }],
        }),
      });
      child = started.child;
      const headers = runtimeAuthorization(started.descriptor);
      const createRes = await fetch(`${started.baseUrl}/v1/projects`, {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ name: "remote-execution-project" }),
      });
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
    } finally {
      if (child) await stopProcess(child);
      if (closeRegistry) await closeRegistry();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 30_000);
};
