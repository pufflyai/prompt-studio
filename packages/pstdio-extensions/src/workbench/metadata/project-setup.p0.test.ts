import { expect, test } from "bun:test";
import { defineExtension, defineView, type ExtensionSettingProperty, packageAsset } from "@pstdio/sdk/extensions";
import { checkExtensionHostCompatibility, dashboardExtensionHostCapabilities } from "../../runtime/host-capabilities";
import type { LoadedExtensionSource } from "../../runtime/loader";
import { normalizeExtensionSources } from "../../runtime/normalize";
import { createWorkbenchExtensionMetadata } from "./workbench-extension-metadata";

const setupView = defineView({
  id: "setup",
  title: "Setup",
  body: { kind: "webview", entry: packageAsset("./setup.tsx", "file:///fixture/") },
});
const source = (definition: LoadedExtensionSource["definition"]): LoadedExtensionSource => ({
  packagePath: "/fixture",
  sourcePath: "/fixture/extension.ts",
  sourceKind: "local_path",
  manifest: {
    id: "example.setup",
    name: "setup",
    publisher: "example",
    version: "1.0.0",
    main: "./extension.ts",
    enginesPstdio: "^0.3.1",
  },
  definition,
});

test("project setup qualifies an owned declared view through public metadata and host capability", () => {
  const runtime = normalizeExtensionSources([
    source(
      defineExtension({
        views: [setupView],
        settings: { properties: { hidden: { type: "boolean", scope: "device", default: false } } },
        projectSetup: { view: setupView.ref, hiddenSetting: "hidden" },
      }),
    ),
  ]);
  expect(runtime.diagnostics).toEqual([]);
  expect(createWorkbenchExtensionMetadata({ runtime }).projectSetups).toEqual([
    {
      extensionId: "example.setup",
      view: { extensionId: "example.setup", kind: "view", id: "setup" },
      hiddenSetting: "hidden",
    },
  ]);
  const host = {
    ...dashboardExtensionHostCapabilities,
    capabilities: Object.fromEntries(
      Object.entries(dashboardExtensionHostCapabilities.capabilities).filter(([key]) => key !== "project-setup.v1"),
    ),
  };
  expect(checkExtensionHostCompatibility(runtime, host).diagnostics).toContainEqual(
    expect.objectContaining({ metadata: expect.objectContaining({ missingCapability: "project-setup.v1" }) }),
  );
});

test("project setup rejects an undeclared or foreign view", () => {
  for (const view of [
    { kind: "view" as const, id: "missing" },
    { kind: "view" as const, id: "setup", extensionId: "other.extension" },
  ]) {
    const runtime = normalizeExtensionSources([
      source(defineExtension({ views: [setupView], projectSetup: { view } })),
    ]);
    expect(runtime.diagnostics).toContainEqual(expect.objectContaining({ code: "invalid_project_setup" }));
    expect(createWorkbenchExtensionMetadata({ runtime }).projectSetups).toEqual([]);
  }
});

test("project setup rejects an undeclared or nonboolean visibility preference", () => {
  const cases: Record<string, ExtensionSettingProperty>[] = [
    {},
    { hidden: { type: "string", scope: "device", default: "false" } },
  ];
  for (const properties of cases) {
    const runtime = normalizeExtensionSources([
      source(
        defineExtension({
          views: [setupView],
          settings: { properties },
          projectSetup: { view: setupView.ref, hiddenSetting: "hidden" },
        }),
      ),
    ]);
    expect(runtime.diagnostics).toContainEqual(expect.objectContaining({ code: "invalid_project_setup" }));
    expect(createWorkbenchExtensionMetadata({ runtime }).projectSetups).toEqual([]);
  }
});
