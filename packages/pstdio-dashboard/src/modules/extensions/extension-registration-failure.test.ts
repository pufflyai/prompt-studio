import { afterEach, describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import { clearCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { createExtensionsModule } from "./module";
import { emptyAppearance, flushMicrotasks, metadata, metadataWithResourceExtension } from "./module-test-fixtures";

const projectId = "extension-registration-failure";
const extensionId = metadata.extensions[0]!.id;
const commandId = metadata.commands[0]!.id;
const viewId = metadata.views[0]!.id;
const resetLayoutCommandId = `dashboard.extensions.resetLayout.${extensionId}`;

afterEach(() => clearCachedDashboardExtensionMetadata(projectId));

describe("extension contribution registration failures", () => {
  test("rolls back the whole refresh when one contribution conflicts", async () => {
    const workbench = createWorkbenchCore();
    selectDashboardProject(workbench, { id: projectId, name: "Registration failure" });
    const conflict = workbench.layout.registerPanel({
      id: viewId,
      title: "Existing view",
      region: "main",
      rendererId: "existing",
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
    expect(workbench.commands.getCommand(resetLayoutCommandId)).toBeUndefined();

    registration.dispose();
    conflict.dispose();
  });

  test("rolls back extension and layout commands when a later layout command conflicts", async () => {
    const workbench = createWorkbenchCore();
    selectDashboardProject(workbench, { id: projectId, name: "Registration failure" });
    const laterExtensionId = metadataWithResourceExtension.extensions[1]!.id;
    const conflictingResetCommandId = `dashboard.extensions.resetLayout.${laterExtensionId}`;
    const conflict = workbench.commands.registerCommand(
      { id: conflictingResetCommandId, label: "Existing reset" },
      { execute: () => undefined },
    );

    const registration = workbench.registerModule(
      createExtensionsModule({
        loadAppearance: async () => emptyAppearance,
        loadMetadata: async () => metadataWithResourceExtension,
      }),
    );
    await flushMicrotasks();
    await flushMicrotasks();

    expect(workbench.commands.getCommand(commandId)).toBeUndefined();
    expect(workbench.layout.getWidget(viewId)).toBeUndefined();
    expect(workbench.commands.getCommand(resetLayoutCommandId)).toBeUndefined();
    expect(workbench.commands.getCommand(conflictingResetCommandId)).toBeDefined();

    registration.dispose();
    conflict.dispose();
  });
});
