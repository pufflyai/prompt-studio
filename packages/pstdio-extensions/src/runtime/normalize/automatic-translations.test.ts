import { describe, expect, test } from "bun:test";
import { defineCommand, defineConnection, defineExtension, defineView, l10n } from "@pstdio/sdk/extensions";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import type { LoadedExtensionSource } from "../loader";
import { normalizeExtensionSources } from "./index";

const normalize = (definition: LoadedExtensionSource["definition"]) =>
  normalizeExtensionSources([
    {
      packagePath: "/fake/lab",
      sourcePath: "/fake/lab/extension.ts",
      sourceKind: "local_path",
      manifest: {
        id: "pstdio.lab",
        name: "lab",
        version: "1.0.0",
        publisher: "pstdio",
        main: "./extension.ts",
        enginesPstdio: EXTENSION_API_VERSION,
      },
      definition,
    },
  ]);

describe("automatic static translations", () => {
  test("normalizes keyed static fields without changing callbacks or data", () => {
    const query = async () => ({ rows: [], columns: [{ id: "runtime", label: "Runtime" }] });
    const command = defineCommand({
      id: "create",
      title: "Create",
      params: { "a/b~c": { type: "text", label: "Name" } },
      run: async () => ({ title: "Result" }),
    });
    const view = defineView({
      id: "table",
      title: "Table",
      body: {
        kind: "dataTable",
        query,
        columns: [{ id: "a/b~c", label: "Column" }],
        rowActions: [{ id: "create", label: "Create row", command: command.ref }],
      },
    });
    const runtime = normalize(
      defineExtension({
        commands: [command],
        views: [view],
        settings: {
          properties: { "editor/theme~name": { type: "string", scope: "project", title: "Theme", default: "dark" } },
        },
      }),
    );
    expect(runtime.views[0].contribution.title).toEqual(l10n("contributions/views/table/title", "Table"));
    expect(runtime.commands[0].params["a/b~c"].label).toEqual(
      l10n("contributions/commands/create/params/a~1b~0c/label", "Name"),
    );
    expect(runtime.settings[0].contribution.title).toEqual(
      l10n("contributions/settings/properties/editor~1theme~0name/title", "Theme"),
    );
    expect(runtime.settings[0].contribution.default).toBe("dark");
    expect(runtime.translations[0].bundles.en["contributions/views/table/body/columns/a~1b~0c/label"]).toBe("Column");
    expect(runtime.translations[0].bundles.en["contributions/views/table/body/rowActions/create/label"]).toBe(
      "Create row",
    );
    expect(runtime.privateHandlers.find((item) => item.operation === "query")?.handler).toBe(query);
    expect(view.title).toBe("Table");
  });

  test("keeps shared and unkeyed tokens and collects providers last", () => {
    const command = defineCommand({
      id: "create",
      title: l10n("shared", "Shared"),
      palette: [{ label: l10n("menu", "Menu") }, { label: "Plain" }],
      run: async () => null,
    });
    const runtime = normalize(
      defineExtension({
        commands: [command],
        connections: [
          defineConnection({
            id: "remote",
            label: "Remote",
            transport: "http",
            auth: { type: "bearer" },
            allowedMethods: ["GET"],
            allowedPathPrefixes: ["/"],
          }),
        ],
      }),
    );
    expect(runtime.commands[0].title).toEqual(l10n("shared", "Shared"));
    expect(runtime.commands[0].palette?.[1].label).toBe("Plain");
    expect(runtime.translations[0].bundles.en).toMatchObject({
      shared: "Shared",
      menu: "Menu",
      "contributions/connections/remote/label": "Remote",
    });
  });
});
