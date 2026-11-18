import { expect, test } from "bun:test";
import { defineExtension, defineView } from "@pstdio/sdk/extensions";
import { EXTENSION_API_VERSION, workbenchExtensionViewRecordSchema } from "pstdio-api-contracts";
import { createWorkbenchExtensionMetadata } from "../../workbench/metadata/workbench-extension-metadata";
import { checkExtensionHostCompatibility, dashboardExtensionHostCapabilities } from "../host-capabilities";
import type { LoadedExtensionSource } from "../loader";
import { normalizeExtensionSources } from "./index";

const query = () => ({ items: [] });
const source: LoadedExtensionSource = {
  packagePath: "/fake/editor",
  sourcePath: "/fake/editor/extension.ts",
  sourceKind: "local_path",
  manifest: {
    id: "example.editor",
    name: "editor",
    publisher: "example",
    version: "1.0.0",
    main: "./extension.ts",
    enginesPstdio: `^${EXTENSION_API_VERSION}`,
  },
  definition: defineExtension({
    views: [defineView({ id: "tools", title: "Tools", body: { kind: "actionBar", query } as never })],
  }),
};

test("native action bars expose a serializable query and require host support", () => {
  const runtime = normalizeExtensionSources([source]);
  expect(runtime.diagnostics).toEqual([]);
  expect(runtime.privateHandlers).toMatchObject([
    { id: "example.editor.view.tools.actionBar.query", rendererKind: "actionBar", handler: query },
  ]);
  const record = createWorkbenchExtensionMetadata({ runtime }).views[0];
  expect(record).toMatchObject({
    body: { kind: "actionBar", queryHandlerId: "example.editor.view.tools.actionBar.query" },
  });
  expect(workbenchExtensionViewRecordSchema.parse(JSON.parse(JSON.stringify(record)))).toEqual(record);
  expect(checkExtensionHostCompatibility(runtime, dashboardExtensionHostCapabilities).diagnostics).toEqual([]);
  const { "view.actionBar.v1": _actionBar, ...capabilities } = dashboardExtensionHostCapabilities.capabilities;
  expect(
    checkExtensionHostCompatibility(runtime, { ...dashboardExtensionHostCapabilities, capabilities }).diagnostics,
  ).toContainEqual(
    expect.objectContaining({
      code: "extension_host_capability_missing",
      metadata: expect.objectContaining({ missingCapability: "view.actionBar.v1" }),
    }),
  );
});
