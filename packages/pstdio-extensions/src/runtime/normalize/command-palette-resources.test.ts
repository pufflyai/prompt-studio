import { describe, expect, test } from "bun:test";
import { defineCommandPaletteResource, defineExtension, defineResourceKind } from "@pstdio/sdk/extensions";
import type { LoadedExtensionSource } from "../loader";
import { normalizeExtensionSources } from "./index";

const wrap = (definition: LoadedExtensionSource["definition"]): LoadedExtensionSource => ({
  packagePath: "/fake/planner",
  sourcePath: "/fake/planner/extension.ts",
  sourceKind: "local_path",
  manifest: {
    id: "pstdio.planner",
    name: "planner",
    version: "1.0.0",
    publisher: "pstdio",
    main: "./extension.ts",
    enginesPstdio: "1.0.0-alpha.4",
  },
  definition,
});

describe("normalizeExtensionSources command palette resources", () => {
  test("registers a typed private query provider", () => {
    const ticket = defineResourceKind({
      id: "ticket",
      surface: "primary",
      slots: [{ id: "primary", cardinality: "one", access: "owner" }],
    });
    const provider = defineCommandPaletteResource({
      id: "tickets",
      title: "Tickets",
      resourceKind: ticket.ref,
      query: async () => ({ items: [] }),
    });
    const runtime = normalizeExtensionSources([
      wrap(defineExtension({ resourceKinds: [ticket], commandPaletteResources: [provider] })),
    ]);

    expect(runtime.diagnostics).toEqual([]);
    expect(runtime.commandPaletteResources[0]).toMatchObject({
      id: "pstdio.planner.command-palette-resource.tickets",
      contribution: {
        resourceKind: { extensionId: "pstdio.planner", kind: "resource-kind", id: "ticket" },
        queryHandlerId: "pstdio.planner.command-palette-resource.tickets.commandPaletteResource.query",
      },
    });
  });

  test("reports a provider without a query callback", () => {
    const invalid = {
      id: "tickets",
      ref: { kind: "command-palette-resource", id: "tickets" },
      title: "Tickets",
    } as unknown as ReturnType<typeof defineCommandPaletteResource>;
    const runtime = normalizeExtensionSources([wrap(defineExtension({ commandPaletteResources: [invalid] }))]);

    expect(runtime.commandPaletteResources).toEqual([]);
    expect(runtime.diagnostics).toContainEqual(expect.objectContaining({ code: "invalid_command_palette_resource" }));
  });
});
