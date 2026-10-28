import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";
import { CORE_EXTENSIONS_SMOKE_TEST_TIMEOUT, withPackagedCoreExtensions } from "./packaged-core-extensions.fixture";
import { expectCoreRecordIds } from "./packaged-core-record-ids-smoke";
import { expectExtensionDraftStorage } from "./packaged-extension-storage-smoke";
import { expectPlannerIdentities } from "./packaged-planner-identities-smoke";
import { runtimeAuthorization } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";
import { expectTicketWorkspaceCleanup } from "./packaged-ticket-workspace-cleanup-smoke";

const settingsWebview = (metadata: WorkbenchExtensionMetadata) => {
  const panelViews = new Set(metadata.settingsPanels.map((panel) => `${panel.view.extensionId}.view.${panel.view.id}`));
  const view = metadata.views.find((view) => panelViews.has(view.id) && view.body.kind === "webview");
  return view?.body.kind === "webview" ? view.body.webview : undefined;
};
const expectCoreSkills = async (baseUrl: string, projectId: string, headers: Record<string, string>) => {
  const skillsRes = await fetch(`${baseUrl}/v1/projects/${projectId}/skills`, {
    headers: headers,
  });
  expect(skillsRes.status).toBe(200);
  const skills = (await skillsRes.json()) as Array<{
    files: Array<{ path: string }>;
    name: string;
  }>;
  for (const name of ["implement-ticket", "pstdio"]) {
    expect(skills).toContainEqual(
      expect.objectContaining({
        name,
        files: expect.arrayContaining([expect.objectContaining({ path: "SKILL.md" })]),
      }),
    );
  }
  expect(skills).toContainEqual(
    expect.objectContaining({
      name: "create-pstdio-extension",
      files: expect.arrayContaining([
        expect.objectContaining({ path: "SKILL.md" }),
        expect.objectContaining({ path: "references/extension-api.md" }),
        expect.objectContaining({ path: "references/client-contracts.md" }),
        expect.objectContaining({ path: "references/native-actions.md" }),
        expect.objectContaining({ path: "references/examples.md" }),
        expect.objectContaining({ path: "references/examples/scribble.ts" }),
        expect.objectContaining({ path: "references/examples/zipline.ts" }),
        expect.objectContaining({ path: "references/examples/pigeon.ts" }),
        expect.objectContaining({ path: "references/examples/controls.ts" }),
        expect.objectContaining({ path: "references/examples/table-navigation.ts" }),
        expect.objectContaining({ path: "references/examples/panel-view.ts" }),
        expect.objectContaining({ path: "references/examples/panel-view-entry.tsx" }),
        expect.objectContaining({ path: "references/examples/resource-reviewer/catalog.ts" }),
        expect.objectContaining({ path: "references/examples/resource-reviewer/commands.ts" }),
        expect.objectContaining({ path: "references/examples/resource-reviewer/extension.ts" }),
        expect.objectContaining({ path: "references/examples/resource-reviewer/inspector.ts" }),
        expect.objectContaining({ path: "references/examples/resource-reviewer/preview-entry.tsx" }),
        expect.objectContaining({ path: "references/examples/resource-reviewer/preview.tsx" }),
        expect.objectContaining({ path: "references/examples/resource-reviewer/style-types.ts" }),
        expect.objectContaining({ path: "references/examples/resource-reviewer/use-review-settings.ts" }),
        expect.objectContaining({ path: "references/pages.md" }),
        expect.objectContaining({ path: "references/validation.md" }),
        expect.objectContaining({ path: "references/webviews.md" }),
      ]),
    }),
  );
};

setupPackagedSmokeTests();

test(
  "loads packaged core defaults with usable assets and safe extension storage",
  async () => {
    await withPackagedCoreExtensions(async ({ started, projectFolder, project, extensions, metadata }) => {
      expect(project.extension_warnings).toBeUndefined();
      const body = { extensions };
      expect(body.extensions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ enabled: true, installName: "harness-claude-code" }),
          expect.objectContaining({ enabled: true, installName: "harness-codex" }),
          expect.objectContaining({ enabled: true, installName: "harness-open-code" }),
          expect.objectContaining({ enabled: true, installName: "pstdio-base-themes" }),
          expect.objectContaining({ canUpgrade: false, enabled: true, installName: "pstdio-planner" }),
          expect.objectContaining({ enabled: true, installName: "pstdio-reports" }),
          expect.objectContaining({ enabled: true, installName: "pstdio-skills" }),
        ]),
      );

      const planner = extensions.find((extension) => extension.installName === "pstdio-planner");
      expect(planner).toBeDefined();
      await expectPlannerIdentities({
        baseUrl: started.baseUrl,
        projectId: project.id,
        headers: runtimeAuthorization(started.descriptor),
      });
      await expectCoreSkills(started.baseUrl, project.id, runtimeAuthorization(started.descriptor));
      execFileSync("git", ["init", "-b", "main"], { cwd: projectFolder, stdio: "pipe" });
      execFileSync(
        "git",
        ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "--allow-empty", "-m", "Initial"],
        { cwd: projectFolder, stdio: "pipe" },
      );
      await expectTicketWorkspaceCleanup(
        started.baseUrl,
        project.id,
        planner!.id,
        { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
        projectFolder,
      );
      await expectExtensionDraftStorage({
        baseUrl: started.baseUrl,
        projectId: project.id,
        projectFolder,
        headers: runtimeAuthorization(started.descriptor),
      });
      const webview = settingsWebview(metadata);
      await expectCoreRecordIds({
        baseUrl: started.baseUrl,
        projectId: project.id,
        headers: runtimeAuthorization(started.descriptor),
      });
      expect(webview?.runtimeUrl).toBeTruthy();

      const runtimeRes = await fetch(`${started.baseUrl}${webview!.runtimeUrl}`, {
        headers: runtimeAuthorization(started.descriptor),
      });
      expect(runtimeRes.status).toBe(200);
    });
  },
  CORE_EXTENSIONS_SMOKE_TEST_TIMEOUT,
);
