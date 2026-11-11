import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";
import { e2eExtensions } from "../default-extensions";
import { folderProjectInput } from "../helpers/folder-project";
import { expectPackagedArtifacts } from "./packaged-artifacts-smoke";
import { expectPackagedRefinement } from "./packaged-refinement-smoke";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";
import { expectPackagedWebviewRuntime } from "./packaged-webview-runtime-smoke";

setupPackagedSmokeTests();

test(
  "serves installed production extension commands and webview runtime",
  async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-packaged-serve-"));
    let child: ChildProcess | null = null;

    try {
      const started = await startPackagedServe(tempRoot, {
        PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions("pstdio-artifacts", "pstdio-planner", "pstdio-reports"),
        // This check exercises metadata and commands; browser suites cover webview builds.
        PSTDIO_EXTENSION_WEBVIEW_BUILDS: "0",
      });
      child = started.child;

      const createRes = await fetch(`${started.baseUrl}/v1/projects`, {
        method: "POST",
        headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
        body: JSON.stringify(folderProjectInput({ name: "packaged-workspace-action-project" })),
      });
      expect(createRes.status).toBe(201);

      const project = (await createRes.json()) as { id: string };
      const metadataRes = await fetch(`${started.baseUrl}/v1/projects/${project.id}/extensions/ui`, {
        headers: runtimeAuthorization(started.descriptor),
      });
      expect(metadataRes.status).toBe(200);

      const metadata = (await metadataRes.json()) as WorkbenchExtensionMetadata;
      await expectPackagedWebviewRuntime(started.baseUrl, metadata);
      await expectPackagedArtifacts({
        baseUrl: started.baseUrl,
        projectId: project.id,
        headers: runtimeAuthorization(started.descriptor),
        metadata,
      });
      await expectPackagedRefinement({
        baseUrl: started.baseUrl,
        projectId: project.id,
        headers: runtimeAuthorization(started.descriptor),
      });
    } finally {
      if (child) {
        await stopProcess(child);
      }
      rmSync(tempRoot, { recursive: true, force: true });
    }
  },
  PACKAGED_TEST_TIMEOUT,
);
