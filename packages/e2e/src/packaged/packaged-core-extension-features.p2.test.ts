import { expect, test } from "bun:test";
import { CORE_EXTENSIONS_SMOKE_TEST_TIMEOUT, withPackagedCoreExtensions } from "./packaged-core-extensions.fixture";
import { expectNotesResources } from "./packaged-notes-resources-smoke";
import { expectPlannerCommands } from "./packaged-planner-commands-smoke";
import { expectPlannerProperties } from "./packaged-planner-properties-smoke";
import { expectPlannerWorkflow } from "./packaged-planner-workflow-smoke";
import { runtimeAuthorization } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";
import { expectTemplateStorage } from "./packaged-template-storage-smoke";
import { expectPackagedThemeColors } from "./packaged-theme-colors-smoke";
import { expectPackagedWorkspaceSelection } from "./packaged-workspace-selection-smoke";

setupPackagedSmokeTests();

test(
  "packaged core extension features preserve their settings, resources and templates",
  async () => {
    await withPackagedCoreExtensions(async ({ started, tempRoot, project, extensions, metadata }) => {
      const planner = extensions.find((extension) => extension.installName === "pstdio-planner");
      expect(planner).toBeDefined();
      await expectPlannerWorkflow(
        started.baseUrl,
        project.id,
        planner!.id,
        runtimeAuthorization(started.descriptor),
        tempRoot,
      );

      await expectPackagedThemeColors(started.baseUrl, project.id, runtimeAuthorization(started.descriptor));

      expect(metadata.pages).toContainEqual(
        expect.objectContaining({
          extensionId: "pstdio.pstdio-planner",
          localId: "tickets",
          path: "tickets",
        }),
      );
      expect(metadata.pages).toContainEqual(
        expect.objectContaining({
          extensionId: "pstdio.pstdio-planner",
          localId: "ticket",
          path: "ticket",
        }),
      );
      expect(metadata.navigationTrees).toContainEqual(
        expect.objectContaining({
          id: "pstdio.pstdio-planner.navigation-tree.ticket-files",
          owner: expect.objectContaining({ kind: "page", id: "ticket" }),
          slot: "content",
          view: expect.objectContaining({ kind: "view", id: "ticket-files" }),
        }),
      );
      expect(metadata.navigationTrees).toContainEqual(
        expect.objectContaining({
          id: "pstdio.pstdio-notes.navigation-tree.note-list",
          owner: expect.objectContaining({ kind: "mode", id: "project" }),
          slot: "content",
        }),
      );
      expect(metadata.settingsSections).toContainEqual(
        expect.objectContaining({ id: "pstdio.pstdio-planner.settings-section.planner" }),
      );
      for (const panel of ["ticket-status", "ticket-tags"]) {
        expect(metadata.settingsPanels).toContainEqual(
          expect.objectContaining({
            id: `pstdio.pstdio-planner.settings-panel.${panel}`,
            section: expect.objectContaining({ id: "planner" }),
          }),
        );
      }
      expect(metadata.views).toContainEqual(
        expect.objectContaining({
          id: "pstdio.pstdio-planner.view.ticket-status-settings",
          icon: "status-progress",
        }),
      );
      await expectPlannerCommands(started.baseUrl, project.id, runtimeAuthorization(started.descriptor), metadata);
      await expectNotesResources({
        baseUrl: started.baseUrl,
        projectId: project.id,
        headers: runtimeAuthorization(started.descriptor),
        metadata,
      });
      const tagsRes = await fetch(
        `${started.baseUrl}/v1/projects/${project.id}/extensions/commands/pstdio.pstdio-planner.command.ticket-tag.read/execute`,
        {
          method: "POST",
          headers: { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" },
          body: JSON.stringify({ source: "api", params: {} }),
        },
      );
      expect(tagsRes.status).toBe(200);
      expect(await tagsRes.json()).toMatchObject({
        outcome: {
          ok: true,
          value: {
            tags: expect.arrayContaining([
              expect.objectContaining({
                id: "default-priority",
                options: expect.arrayContaining([
                  expect.objectContaining({ id: "default-priority-low", icon: "level-low" }),
                  expect.objectContaining({ id: "default-priority-medium", icon: "level-mid" }),
                  expect.objectContaining({ id: "default-priority-high", icon: "level-high" }),
                ]),
              }),
            ]),
          },
        },
      });
      await expectPlannerProperties(started.baseUrl, project.id, runtimeAuthorization(started.descriptor));
      await expectPackagedWorkspaceSelection(started.descriptor, project.id);
      await expectTemplateStorage(metadata, started.baseUrl, project.id, runtimeAuthorization(started.descriptor));
    });
  },
  CORE_EXTENSIONS_SMOKE_TEST_TIMEOUT,
);
