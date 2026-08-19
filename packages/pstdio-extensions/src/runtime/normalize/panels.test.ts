import { describe, expect, test } from "bun:test";
import { defineExtension } from "@pstdio/sdk/extensions";
import type { LoadedExtensionSource } from "../loader";
import { normalizeExtensionSources } from "./index";

const wrap = (definition: ReturnType<typeof defineExtension>): LoadedExtensionSource => ({
  packagePath: "/fake/planner",
  sourcePath: "/fake/planner/extension.ts",
  sourceKind: "local_path",
  manifest: {
    id: "pstdio.planner",
    name: "planner",
    version: "1.0.0",
    publisher: "pstdio",
    main: "./extension.ts",
    enginesPstdio: "^1.0.0",
  },
  definition,
});

describe("renderer-backed panels", () => {
  test("accepts one renderer reference for every native renderer kind", () => {
    const runtime = normalizeExtensionSources([
      wrap(
        defineExtension({
          kanbanRenderers: {
            tickets: { title: "Tickets", query: async () => ({ rows: [] }) },
          },
          panels: {
            tickets: {
              title: "Tickets",
              supportedRegions: ["main"],
              renderer: { kind: "kanban", id: "tickets" },
            },
          },
        }),
      ),
    ]);

    expect(runtime.diagnostics).toEqual([]);
    expect(runtime.panels[0]?.contribution).toMatchObject({ renderer: { kind: "kanban", id: "tickets" } });
  });

  test("rejects a renderer reference whose kind and id do not match", () => {
    const runtime = normalizeExtensionSources([
      wrap(
        defineExtension({
          kanbanRenderers: {
            tickets: { title: "Tickets", query: async () => ({ rows: [] }) },
          },
          panels: {
            tickets: {
              title: "Tickets",
              supportedRegions: ["main"],
              renderer: { kind: "tree", id: "tickets" },
            },
          },
        }),
      ),
    ]);

    expect(runtime.panels).toEqual([]);
    expect(runtime.diagnostics).toContainEqual(expect.objectContaining({ code: "extension_panel_renderer_missing" }));
  });

  test("accepts the capability shape and rejects a panel without supported regions", () => {
    const runtime = normalizeExtensionSources([
      wrap(
        defineExtension({
          kanbanRenderers: {
            tickets: { title: "Tickets", query: async () => ({ rows: [] }) },
          },
          panels: {
            capability: {
              title: "Tickets",
              supportedRegions: ["main", "side"],
              renderer: { kind: "kanban", id: "tickets" },
            },
            invalid: {
              title: "No placement contract",
              renderer: { kind: "kanban", id: "tickets" },
            } as never,
          },
        }),
      ),
    ]);

    expect(runtime.panels.map((panel) => panel.localId)).toEqual(["capability"]);
    expect(runtime.diagnostics).toContainEqual(expect.objectContaining({ code: "extension_panel_contract_invalid" }));
  });
});
