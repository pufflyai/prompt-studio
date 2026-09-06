import { afterEach, describe, expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import {
  clearCachedDashboardExtensionMetadata,
  dashboardEditableTemplatesContextKey,
} from "@/shared/extensions/workbench-extension-contributions";
import { createExtensionsModule } from "./module";
import { emptyAppearance, flushMicrotasks, metadata } from "./module-test-fixtures";

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

  test("rolls back the whole refresh when one contribution conflicts", async () => {
    const workbench = createWorkbench();
    selectDashboardProject(workbench, { id: projectId, name: "Registration failure" });
    const conflict = workbench.views.registerView({
      id: viewId,
      title: "Existing view",
      body: { kind: "react", render: () => null },
    });

    const registration = workbench.registerModule(
      createExtensionsModule({
        loadAppearance: async () => emptyAppearance,
        loadMetadata: async () => metadata,
      }),
    );
    await flushMicrotasks();
    await flushMicrotasks();

    expect(workbench.commands.getCommand(commandId)).toBeUndefined();
    expect(workbench.context.get(dashboardEditableTemplatesContextKey)).toBe(false);

    registration.dispose();
    conflict.dispose();
  });
});
