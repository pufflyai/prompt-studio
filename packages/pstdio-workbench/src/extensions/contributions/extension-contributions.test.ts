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
