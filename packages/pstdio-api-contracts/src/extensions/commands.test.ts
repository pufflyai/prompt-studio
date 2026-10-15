import { expect, test } from "bun:test";
import { extensionMenuContributionSchema } from "./commands";

test("menu transport preserves subject availability and its localized explanation", () => {
  const contribution = {
    id: "rename",
    extensionId: "acme.notes",
    commandId: "acme.notes.command.rename",
    slotId: "acme.notes.menu.note",
    label: "Rename",
    disabledWhen: { resourceType: ["note"], metadata: { writable: false } },
    disabledReason: { $l10n: "note.readOnly", default: "This note is read only" },
  };
  expect(extensionMenuContributionSchema.parse(contribution)).toEqual(contribution);
});
