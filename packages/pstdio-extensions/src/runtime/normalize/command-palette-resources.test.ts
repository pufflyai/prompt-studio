import { describe, expect, test } from "bun:test";
import { defineExtension } from "@pstdio/sdk/extensions";
import type { LoadedExtensionSource } from "../loader";
import { normalizeExtensionSources } from "./index";

const wrap = (name: string, definition: ReturnType<typeof defineExtension>): LoadedExtensionSource => ({
  packagePath: `/fake/${name}`,
  sourcePath: `/fake/${name}/extension.ts`,
  sourceKind: "local_path",
  manifest: {
    id: `pstdio.${name}`,
    name,
    version: "1.0.0",
    publisher: "pstdio",
    main: "./extension.ts",
    enginesPstdio: "^1.0.0",
  },
  definition,
});

describe("normalizeExtensionSources command palette resources", () => {
  test("registers command palette resource provider contributions", () => {
    const planner = defineExtension({
      commandPaletteResources: {
        tickets: {
          title: "Tickets",
          resourceKind: "ticket",
          queryCommand: "planner.queryTickets",
        },
      },
    });

    const runtime = normalizeExtensionSources([wrap("planner", planner)]);

    expect(runtime.diagnostics).toEqual([]);
    expect(runtime.commandPaletteResources).toEqual([
      expect.objectContaining({
        id: "planner.tickets",
        localId: "tickets",
        extensionId: "pstdio.planner",
        contribution: expect.objectContaining({
          title: "Tickets",
          resourceKind: "ticket",
          queryCommand: "planner.queryTickets",
        }),
      }),
    ]);
  });

  test("reports a diagnostic for a provider without a query command", () => {
    const planner = defineExtension({
      commandPaletteResources: {
        // @ts-expect-error queryCommand is required
        tickets: {
          title: "Tickets",
        },
      },
    });

    const runtime = normalizeExtensionSources([wrap("planner", planner)]);

    expect(runtime.commandPaletteResources).toEqual([]);
    expect(runtime.diagnostics).toEqual([
      expect.objectContaining({
        code: "invalid_command_palette_resource",
        extensionId: "pstdio.planner",
      }),
    ]);
  });
});
