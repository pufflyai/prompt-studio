import { describe, expect, test } from "bun:test";
import { createResourceRowActions } from "./list-row-content";

describe("createResourceRowActions", () => {
  test("keeps distinct actions that share a label", () => {
    const [action] = createResourceRowActions({
      id: "ticket-1",
      label: "Ticket",
      actions: [{ id: "open-inline", label: "Open" }],
      contextMenuItems: [{ id: "open-context", label: "Open" }],
    });

    expect(action?.menuItems?.map((item) => item.id)).toEqual(["open-inline", "open-context"]);
  });

  test("deduplicates the same action id", () => {
    const [action] = createResourceRowActions({
      id: "ticket-1",
      label: "Ticket",
      actions: [{ id: "archive", label: "Archive" }],
      contextMenuItems: [{ id: "archive", label: "Archive ticket" }],
    });

    expect(action?.menuItems?.map((item) => item.id)).toEqual(["archive"]);
  });
});
