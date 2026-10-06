import { afterEach, describe, expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import {
  clearCachedDashboardExtensionMetadata,
  dashboardEditableTemplatesContextKey,
  getCachedDashboardExtensionMetadata,
} from "@/shared/extensions/workbench-extension-contributions";
import { createExtensionsModule } from "./module";
import { emptyAppearance, flushMicrotasks, metadata, metadataWithResourceExtension } from "./module-test-fixtures";

const projectId = "extension-registration-failure";
const commandId = metadata.commands[0]!.id;
const viewId = metadata.views[0]!.id;

afterEach(() => clearCachedDashboardExtensionMetadata(projectId));

describe("extension contribution registration failures", () => {
  test("does not publish editable templates when template assets belong to another extension", async () => {
    const workbench = createWorkbench();
    selectDashboardProject(workbench, { id: projectId, name: "Editable templates" });
    const metadataWithEditableTemplates = {
      ...metadata,
      templates: [
        {
          id: "pstdio.extension-lab.template.example",
          localId: "example",
          extensionId: "pstdio.extension-lab",
          title: "Example",
        },
      ],
      templateTypes: [
        {
          id: "pstdio.pstdio-planner.template-type.prompt",
          localId: "prompt",
          extensionId: "pstdio.pstdio-planner",
          label: "Prompt",
          commands: {
            list: "pstdio.pstdio-planner.command.templates-list",
            read: "pstdio.pstdio-planner.command.templates-read",
            save: "pstdio.pstdio-planner.command.templates-save",
            delete: "pstdio.pstdio-planner.command.templates-delete",
          },
        },
      ],
    };

    const registration = workbench.registerModule(
      createExtensionsModule({
        loadAppearance: async () => emptyAppearance,
        loadMetadata: async () => metadataWithEditableTemplates,
      }),
    );
    await flushMicrotasks();
    await flushMicrotasks();

    expect(workbench.context.get(dashboardEditableTemplatesContextKey)).toBe(false);

    registration.dispose();
  });

  test("publishes editable templates when the same extension contributes assets and a provider", async () => {
    const workbench = createWorkbench();
    selectDashboardProject(workbench, { id: projectId, name: "Editable templates" });
    const metadataWithEditableTemplates = {
      ...metadata,
      templates: [
        {
          id: "pstdio.pstdio-planner.template.implement-ticket",
          localId: "implement-ticket",
          extensionId: "pstdio.pstdio-planner",
          title: "Implement ticket",
        },
      ],
      templateTypes: [
        {
          id: "pstdio.pstdio-planner.template-type.prompt",
          localId: "prompt",
          extensionId: "pstdio.pstdio-planner",
          label: "Prompt",
          commands: {
            list: "pstdio.pstdio-planner.command.templates-list",
            read: "pstdio.pstdio-planner.command.templates-read",
            save: "pstdio.pstdio-planner.command.templates-save",
            delete: "pstdio.pstdio-planner.command.templates-delete",
          },
        },
      ],
    };

    const registration = workbench.registerModule(
      createExtensionsModule({
        loadAppearance: async () => emptyAppearance,
        loadMetadata: async () => metadataWithEditableTemplates,
      }),
    );
    await flushMicrotasks();
    await flushMicrotasks();

    expect(workbench.context.get(dashboardEditableTemplatesContextKey)).toBe(true);

    registration.dispose();
  });

  test("keeps the other extensions when one extension conflicts and retries the same metadata", async () => {
    const workbench = createWorkbench();
    selectDashboardProject(workbench, { id: projectId, name: "Registration failure" });
    const issuesViewId = metadataWithResourceExtension.views.find(
      (view) => view.extensionId === "acme.issue-tracker",
    )!.id;
    const conflict = workbench.views.registerView({
      id: issuesViewId,
      title: "Existing view",
      body: { kind: "react", render: () => null },
    });
    const writer = getWriter("extension_instances");

    const registration = workbench.registerModule(
      createExtensionsModule({
        loadAppearance: async () => emptyAppearance,
        loadMetadata: async () => metadataWithResourceExtension,
      }),
    );
    try {
      await flushMicrotasks();
      await flushMicrotasks();

      expect(workbench.commands.getCommand(commandId)).toBeDefined();
      expect(workbench.views.getView(viewId)).toBeDefined();
      expect(workbench.views.getView(issuesViewId)?.title).toBe("Existing view");
      expect(getCachedDashboardExtensionMetadata(projectId)?.extensions.map((extension) => extension.id)).toEqual([
        "pstdio.extension-lab",
      ]);

      conflict.dispose();
      writer?.upsert({ id: "registration-retry" });
      await flushMicrotasks();
      await flushMicrotasks();

      expect(workbench.views.getView(issuesViewId)?.title).toBe("Issues");
      expect(getCachedDashboardExtensionMetadata(projectId)?.extensions).toHaveLength(2);
    } finally {
      registration.dispose();
      writer?.remove("registration-retry");
    }
  });
});
