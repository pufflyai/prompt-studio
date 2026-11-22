import { describe, expect, test } from "bun:test";
import { defineExtension, defineView, packageAsset, type ViewContribution } from "@pstdio/sdk/extensions";
import { workbenchExtensionMetadataSchema } from "pstdio-api-contracts";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createWorkbenchExtensionMetadata } from "../../workbench/metadata/workbench-extension-metadata";
import type { LoadedExtensionSource } from "../loader";
import { normalizeExtensionSources } from "./index";

const view = (id: string, header?: string) =>
  defineView({
    id,
    title: id,
    ...(header ? { header: { view: { kind: "view" as const, id: header } } } : {}),
    body: { kind: "webview", entry: packageAsset("./view.tsx", "file:///fake/headers/") },
  });
const normalize = (...views: ViewContribution[]) =>
  normalizeExtensionSources([
    {
      packagePath: "/fake/headers",
      sourcePath: "/fake/headers/extension.ts",
      sourceKind: "local_path",
      manifest: {
        id: "test.headers",
        name: "headers",
        publisher: "test",
        version: "1.0.0",
        main: "./extension.ts",
        enginesPstdio: `^${EXTENSION_API_VERSION}`,
      },
      definition: defineExtension({ views }),
    } satisfies LoadedExtensionSource,
  ]);

describe("view-owned header contributions", () => {
  test("normalizes the header reference so pages and tabs share the same declared view", () => {
    const runtime = normalize(view("reader", "toolbar"), view("toolbar"));
    expect(runtime.diagnostics).toEqual([]);
    expect(runtime.views[0]?.contribution).toMatchObject({
      header: { view: { kind: "view", extensionId: "test.headers", id: "toolbar" } },
    });
  });
  test("preserves companion headers through the public metadata boundary", () => {
    const toolbar = defineView({
      id: "toolbar",
      title: "Toolbar",
      body: { kind: "controls", query: () => ({ params: [] }) },
    });
    const reader = defineView({
      id: "reader",
      title: "Reader",
      header: { view: toolbar.ref },
      menuHeader: { multipleMenus: true },
      body: { kind: "controls", query: () => ({ params: [] }) },
    });
    const metadata = workbenchExtensionMetadataSchema.parse(
      createWorkbenchExtensionMetadata({ runtime: normalize(reader, toolbar) }),
    );
    expect(metadata.views.find((entry) => entry.localId === "reader")?.menuHeader).toEqual({ multipleMenus: true });
    expect(metadata.views.find((entry) => entry.localId === "reader")?.header).toEqual({
      view: { kind: "view", extensionId: "test.headers", id: "toolbar" },
    });
  });
  test("diagnoses a missing header view with its declaration field", () => {
    const runtime = normalize(view("reader", "missing"));
    expect(runtime.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "extension_view_missing",
        metadata: expect.objectContaining({ fieldPath: "views.reader.header.view" }),
      }),
    );
  });
  test("rejects direct and indirect header cycles", () => {
    for (const views of [[view("reader", "reader")], [view("reader", "toolbar"), view("toolbar", "reader")]]) {
      const runtime = normalize(...views);
      expect(runtime.diagnostics).toContainEqual(expect.objectContaining({ code: "extension_view_header_cycle" }));
    }
  });
});
