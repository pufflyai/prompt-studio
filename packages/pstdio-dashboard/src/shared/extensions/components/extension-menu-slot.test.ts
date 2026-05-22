import { describe, expect, it } from "bun:test";
import { getExtensionActionButtonVariant } from "./extension-menu-slot";

describe("getExtensionActionButtonVariant", () => {
  it("renders header-primary menu slots as primary buttons by default", () => {
    expect(getExtensionActionButtonVariant({ slotId: "ticket.headerPrimary" })).toBe("primary");
  });

  it("keeps non-primary header actions outlined by default", () => {
    expect(getExtensionActionButtonVariant({ slotId: "ticket.headerOverflow" })).toBe("outline");
  });
});
