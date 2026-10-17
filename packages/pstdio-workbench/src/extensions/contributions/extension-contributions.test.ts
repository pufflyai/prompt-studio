import { describe, expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { buildWorkbenchExtensionMenuRegistrations, emptyWorkbenchExtensionMetadata } from "./extension-contributions";

const metadata = {
  ...emptyWorkbenchExtensionMetadata,
  commands: [
    { id: "lab.command.open", extensionId: "lab", title: "Open" },
    { id: "lab.command.missing", extensionId: "lab", title: "Missing" },
  ],
  menuContributions: [
    {
      id: "lab.open",
      extensionId: "lab",
      commandId: "lab.command.open",
      slotId: "note.headerPrimary",
      label: "Open note",
    },
    {
      id: "lab.missing",
      extensionId: "lab",
      commandId: "lab.command.missing",
      slotId: "missing.headerPrimary",
      label: "Missing target",
    },
  ],
} satisfies WorkbenchExtensionMetadata;

describe("buildWorkbenchExtensionMenuRegistrations", () => {
  test("retains resource mutation semantics on contributed command aliases", () => {
    const mutation = { kind: "rename" as const, resourceType: "note", idParam: "noteId", labelParam: "title" };
    const result = buildWorkbenchExtensionMenuRegistrations({
      metadata: { ...metadata, commands: [{ ...metadata.commands[0], resourceMutation: mutation }] },
      menuSlotsById: new Map([["note.headerPrimary", { menuPath: ["header"] }]]),
    });
    expect(result.registrations[0]?.command.resourceMutation).toEqual(mutation);
  });
  test("keeps each declaration's identity when another declaration is inserted", () => {
    const original = metadata.menuContributions[0];
    const build = (contributions: typeof metadata.menuContributions) =>
      buildWorkbenchExtensionMenuRegistrations({
        metadata: { ...metadata, menuContributions: contributions },
        menuSlotsById: new Map([["note.headerPrimary", { menuPath: ["header"] }]]),
      }).registrations;
    const before = build([original]);
    const after = build([{ ...original, id: "lab.other", label: "Other note" }, original]);
    expect(after[1]?.menuItem.id).toBe(before[0]?.menuItem.id);
    expect(after[0]?.menuItem.id).not.toBe(before[0]?.menuItem.id);
  });
  test("resolves option command references on menu action parameters", () => {
    const result = buildWorkbenchExtensionMenuRegistrations({
      metadata: {
        ...metadata,
        commands: [
          {
            ...metadata.commands[0],
            params: {
              instance: { type: "text", resolvedFrom: "resource" },
              template: {
                type: "select",
                options: {
                  command: { kind: "command", id: "templates" },
                  valueField: "id",
                  labelField: "name",
                  params: { instance: { kind: "param-value", key: "instance" } },
                },
              },
            },
          },
        ],
      },
      menuSlotsById: new Map([["note.headerPrimary", { menuPath: ["header"] }]]),
    });
    expect(result.registrations[0]?.command.params?.template.options).toMatchObject({
      commandId: "lab.command.templates",
    });
  });
  test("returns registrations and unresolved contribution targets", () => {
    const result = buildWorkbenchExtensionMenuRegistrations({
      metadata,
      menuSlotsById: new Map([["note.headerPrimary", { menuPath: ["header"] }]]),
    });

    expect(result.registrations.map((registration) => registration.contribution.id)).toEqual(["lab.open"]);
    expect(result.unresolved).toEqual([
      {
        contribution: metadata.menuContributions[1],
        targetId: "missing.headerPrimary",
      },
    ]);
  });
});
