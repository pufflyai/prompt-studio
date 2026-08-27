import { describe, expect, test } from "bun:test";
import { defineCommand, defineExtension, defineResourceKind, resourceMenuSlotRef } from "@pstdio/sdk/extensions";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import type { LoadedExtensionSource } from "../loader";
import { normalizeExtensionSources } from "./index";

const source = (name: string, definition: LoadedExtensionSource["definition"]): LoadedExtensionSource => ({
  packagePath: `/fake/${name}`,
  sourcePath: `/fake/${name}/extension.ts`,
  sourceKind: "local_path",
  manifest: {
    id: `pstdio.${name}`,
    name,
    version: "1.0.0",
    publisher: "pstdio",
    main: "./extension.ts",
    enginesPstdio: EXTENSION_API_VERSION,
  },
  definition,
});

describe("resource menu slot ownership", () => {
  test("rejects another extension from an owner-only menu slot but keeps public slots", () => {
    const ticket = defineResourceKind({
      id: "ticket",
      surface: "primary",
      slots: [{ id: "primary", cardinality: "one", access: "owner" }],
      menuSlots: [
        { id: "private", placement: "header-overflow", access: "owner" },
        { id: "public", placement: "header-overflow", access: "public" },
      ],
    });
    const intruder = defineCommand({
      id: "intrude",
      title: "Intrude",
      menus: [
        { slot: resourceMenuSlotRef(ticket.ref, "private") },
        { slot: resourceMenuSlotRef(ticket.ref, "public") },
      ],
      async run() {},
    });

    const runtime = normalizeExtensionSources([
      source("owner", defineExtension({ resourceKinds: [ticket] })),
      source("intruder", defineExtension({ commands: [intruder] })),
    ]);

    expect(runtime.commands.find((command) => command.localId === "intrude")?.menus).toEqual([
      expect.objectContaining({ slot: expect.objectContaining({ id: "ticket.public" }) }),
    ]);
    expect(runtime.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "extension_resource_menu_slot_closed",
        extensionId: "pstdio.intruder",
        metadata: expect.objectContaining({ failedReference: "ticket.private" }),
      }),
    );
  });

  test("keeps the first resource kind when another extension declares the same id", () => {
    const first = defineResourceKind({
      id: "recipe",
      surface: "primary",
      slots: [{ id: "primary", cardinality: "one", access: "owner" }],
      menuSlots: [{ id: "first", placement: "header-overflow", access: "owner" }],
    });
    const duplicate = defineResourceKind({
      id: "recipe",
      surface: "primary",
      slots: [{ id: "primary", cardinality: "one", access: "owner" }],
      menuSlots: [{ id: "duplicate", placement: "header-overflow", access: "owner" }],
    });

    const runtime = normalizeExtensionSources([
      source("owner", defineExtension({ resourceKinds: [first] })),
      source("intruder", defineExtension({ resourceKinds: [duplicate] })),
    ]);

    expect(runtime.resourceKinds).toHaveLength(1);
    expect(runtime.resourceKinds[0]).toMatchObject({
      extensionId: "pstdio.owner",
      contribution: { menuSlots: { first: {} } },
    });
    expect(runtime.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "extension_resource_kind_duplicate",
        extensionId: "pstdio.intruder",
        metadata: expect.objectContaining({ failedReference: "recipe" }),
      }),
    );
  });

  test("rejects extension declarations of host resource kinds", () => {
    const project = defineResourceKind({
      id: "project",
      surface: "primary",
      slots: [{ id: "primary", cardinality: "one", access: "owner" }],
      menuSlots: [{ id: "intruder", placement: "header-overflow", access: "owner" }],
    });

    const runtime = normalizeExtensionSources([source("intruder", defineExtension({ resourceKinds: [project] }))]);

    expect(runtime.resourceKinds).toEqual([]);
    expect(runtime.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "extension_resource_kind_reserved",
        extensionId: "pstdio.intruder",
        metadata: expect.objectContaining({ failedReference: "project" }),
      }),
    );
  });
});
