import { expect, test } from "bun:test";
import { defineExtension, defineView } from "@pstdio/sdk/extensions";
import { workbenchExtensionMetadataSchema } from "pstdio-api-contracts";
import type { LoadedExtensionSource } from "../../runtime/loader";
import { normalizeExtensionSources } from "../../runtime/normalize";
import { createWorkbenchExtensionMetadata } from "./workbench-extension-metadata";

test("an extension declares a native resource list through the public SDK", () => {
  const view = defineView({
    id: "resources",
    title: "Resources",
    body: {
      kind: "resourceList",
      attributes: [
        {
          id: "device",
          label: "Device",
          type: {
            kind: "enum",
            options: [{ value: "local", label: "This device", color: "green", note: "Online", canCreate: true }],
          },
        },
      ],
      defaultSettings: { columnGrouping: "device", showChildren: true },
      defaultViews: [
        {
          id: "compact",
          title: "Compact",
          settings: { columnGrouping: "device", displayProperties: [], showChildren: false },
        },
      ],
      query: async () => ({
        rows: [
          {
            id: "parent",
            title: "Workspace",
            icon: "folder",
            attributes: { device: "local" },
            children: [{ id: "child", title: "Session", attributes: {} }],
          },
        ],
      }),
    },
  });
  const source: LoadedExtensionSource = {
    packagePath: "/fake/resources",
    sourcePath: "/fake/resources/extension.ts",
    sourceKind: "local_path",
    manifest: {
      id: "example.resources",
      name: "resources",
      publisher: "example",
      version: "1.0.0",
      main: "./extension.ts",
      enginesPstdio: "^0.1.6",
    },
    definition: defineExtension({ views: [view] }),
  };
  const runtime = normalizeExtensionSources([source]);
  const metadata = workbenchExtensionMetadataSchema.parse(createWorkbenchExtensionMetadata({ runtime }));
  expect(metadata.views[0].body).toMatchObject({
    kind: "resourceList",
    queryHandlerId: "example.resources.view.resources.resourceList.query",
    defaultSettings: { viewMode: "list", columnGrouping: "device", rowGrouping: "none", showChildren: true },
    defaultViews: [{ settings: { viewMode: "list", showChildren: false } }],
    attributes: [{ type: { options: [{ note: "Online", canCreate: true }] } }],
  });
});
