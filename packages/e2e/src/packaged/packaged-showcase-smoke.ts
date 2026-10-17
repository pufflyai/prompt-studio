import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";
import { e2eExtensions } from "../default-extensions";
import { folderProjectInput } from "../helpers/folder-project";
import { expectPackagedArtifacts } from "./packaged-artifacts-smoke";
import { expectExamplePages } from "./packaged-example-metadata";
import { expectPackagedRefinement } from "./packaged-refinement-smoke";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";
import { expectPackagedWebviewRuntime } from "./packaged-webview-runtime-smoke";

export function registerPackagedShowcaseSmokeTests() {
  test(
    "serves workspace actions and complete showcase mode metadata",
    async () => {
      const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-packaged-serve-"));
      let child: ChildProcess | null = null;

      try {
        const started = await startPackagedServe(tempRoot, {
          PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions(
            "workbench-fixture",
            "extension-lab",
            "pstdio-artifacts",
            "pstdio-planner",
            "pstdio-reports",
          ),
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
        expectExamplePages(metadata);
        expect(
          metadata.commands.find(
            (command) => command.id === "pstdio.workbench-fixture.command.glass-lab-artifacts.delete",
          )?.resourceMutation,
        ).toEqual({
          kind: "remove",
          resourceType: "glass-lab-artifact",
          idParam: "rowId",
        });
        await expectPackagedWebviewRuntime(started.baseUrl, metadata);
        await expectPackagedArtifacts({
          baseUrl: started.baseUrl,
          projectId: project.id,
          headers: runtimeAuthorization(started.descriptor),
          metadata,
        });
        expect(
          existsSync(join(tempRoot, "extensions", "pstdio-planner", "src", "commands", "auto-build-resume.ts")),
        ).toBe(true);
        expect(
          existsSync(join(tempRoot, "extensions", "pstdio-planner", "src", "commands", "auto-build-candidates.ts")),
        ).toBe(true);
        expect(existsSync(join(tempRoot, "extensions", "pstdio-planner", "src", "commands", "next-tickets.ts"))).toBe(
          true,
        );
        expect(existsSync(join(tempRoot, "extensions", "pstdio-planner", "src", "commands", "update-stack.ts"))).toBe(
          true,
        );
        expect(
          existsSync(join(tempRoot, "extensions", "pstdio-planner", "src", "commands", "stack-validation.ts")),
        ).toBe(true);
        expect(
          existsSync(join(tempRoot, "extensions", "pstdio-planner", "src", "timeline", "model", "milestone-eta.ts")),
        ).toBe(true);
        expect(
          existsSync(join(tempRoot, "extensions", "pstdio-planner", "src", "timeline", "view", "milestone-eta.tsx")),
        ).toBe(true);
        expect(
          existsSync(join(tempRoot, "extensions", "pstdio-planner", "src", "timeline", "view", "use-canvas-pan.ts")),
        ).toBe(true);
        expect(
          existsSync(join(tempRoot, "extensions", "pstdio-planner", "src", "timeline", "view", "use-canvas-zoom.ts")),
        ).toBe(true);
        await expectPackagedRefinement({
          baseUrl: started.baseUrl,
          projectId: project.id,
          headers: runtimeAuthorization(started.descriptor),
        });
        const counter = await fetch(
          `${started.baseUrl}/v1/projects/${project.id}/extensions/commands/pstdio.workbench-fixture.command.counter.bump/execute`,
          {
            method: "POST",
            headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
            body: JSON.stringify({ params: {} }),
          },
        );
        expect(counter.status).toBe(200);
        expect(await counter.json()).toMatchObject({
          outcome: { status: "success", value: { counter: 1 } },
          eventIds: expect.arrayContaining(["pstdio.workbench-fixture.event.counter.changed"]),
        });
        const workspaceAction = metadata.menuContributions.find(
          (contribution) => contribution.label === "Workspace-only lab action",
        );
        expect(workspaceAction?.when).toEqual({ resourceType: ["workspace"] });
        expect(metadata.pages).toContainEqual(
          expect.objectContaining({
            extensionId: "pstdio.workbench-fixture",
            localId: "lab",
            path: "lab",
          }),
        );
        expect(metadata.navigationTrees).toContainEqual(
          expect.objectContaining({
            id: "pstdio.workbench-fixture.navigation-tree.lab-cameras",
            owner: expect.objectContaining({ kind: "page", id: "lab" }),
            slot: "content",
            view: expect.objectContaining({ kind: "view", id: "camera-tree" }),
          }),
        );
      } finally {
        if (child) {
          await stopProcess(child);
        }
        rmSync(tempRoot, { recursive: true, force: true });
      }
    },
    PACKAGED_TEST_TIMEOUT,
  );
}
