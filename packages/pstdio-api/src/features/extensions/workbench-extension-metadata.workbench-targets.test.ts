import { describe, expect, test } from "bun:test";
import { packageAsset } from "@pstdio/sdk/extensions";
import { normalizeExtensionSources } from "pstdio-extensions";
import { buildWorkbenchExtensionMetadata } from "./workbench-extension-metadata";

describe("buildWorkbenchExtensionMetadata workbench targets", () => {
  test("preserves workbench targets without projecting tree items into legacy navigation", () => {
    const runtime = normalizeExtensionSources([
      {
        sourcePath: "/extension/extension.ts",
        sourceKind: "local_path",
        packagePath: "/extension",
        manifest: {
          id: "pstdio.lab",
          name: "lab",
          displayName: "Lab",
          version: "1.0.0",
          publisher: "pstdio",
          main: "./extension.ts",
          enginesPstdio: "^1.0.0",
        },
        definition: {
          commands: {
            review: {
              title: "Review",
              menus: [
                {
                  target: "workbench.nav.actions",
                  label: "Review",
                  when: { mode: "workspace", resourceType: ["workspace"] },
                },
              ],
              run: async () => undefined,
            },
          },
          treeItems: {
            lab: {
              target: "workbench.left.tree",
              label: "Lab",
              action: { kind: "route", route: "lab" },
              when: { mode: "project" },
            },
          },
          settingsPanels: {
            projectPanel: {
              target: "workbench.settings",
              scope: "project",
              title: "Project panel",
              webview: { entry: packageAsset("./settings.tsx", "file:///extension/extension.ts") },
            },
          },
        },
      },
    ]);

    const metadata = buildWorkbenchExtensionMetadata({
      installNamesByExtensionId: new Map([["pstdio.lab", "lab"]]),
      runtime,
      webviewCacheRoot: "/cache",
    });

    expect(metadata.menuContributions[0]).toMatchObject({
      target: "workbench.nav.actions",
      slotId: "workspace.headerPrimary",
      when: { mode: "workspace", resourceType: ["workspace"] },
    });
    expect(metadata.treeItems?.[0]).toMatchObject({
      target: "workbench.left.tree",
      when: { mode: "project" },
    });
    expect(metadata.navigation).toEqual([]);
    expect(metadata.settingsPanels[0]).toMatchObject({
      target: "workbench.settings",
      scope: "project",
      slotId: "project.settingsPanels",
    });
  });
});
