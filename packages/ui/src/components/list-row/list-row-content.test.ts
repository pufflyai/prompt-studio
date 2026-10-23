import { describe, expect, test } from "bun:test";
import { createResourceRowActions } from "./list-row-content";

describe("createResourceRowActions", () => {
  test("keeps disabled actions disabled in the resource menu", () => {
    const [action] = createResourceRowActions(
      {
        id: "ticket-1",
        label: "Ticket",
        actions: [{ id: "archive", label: "Archive", disabled: true }],
        contextMenuItems: [{ id: "open", label: "Open" }],
      },
      true,
    );

    expect(action?.menuItems?.find((item) => item.id === "archive")?.disabled).toBe(true);
  });

  test("keeps distinct actions that share a label", () => {
    const [action] = createResourceRowActions(
      {
        id: "ticket-1",
        label: "Ticket",
        actions: [{ id: "open-inline", label: "Open" }],
        contextMenuItems: [{ id: "open-context", label: "Open" }],
      },
      true,
    );

    expect(action?.menuItems?.map((item) => item.id)).toEqual(["open-inline", "open-context"]);
  });

  test("keeps a disabled action's menu items disabled after flattening", () => {
    const [action] = createResourceRowActions(
      {
        label: "Ticket",
        actions: [{ id: "archive", label: "Archive", disabled: true, menuItems: [{ id: "all", label: "All" }] }],
        contextMenuItems: [{ id: "open", label: "Open" }],
      },
      true,
    );
    expect(action?.menuItems?.find((item) => item.id === "all")?.disabled).toBe(true);
  });

  test("deduplicates the same action id", () => {
    const [action] = createResourceRowActions(
      {
        id: "ticket-1",
        label: "Ticket",
        actions: [{ id: "archive", label: "Archive" }],
        contextMenuItems: [{ id: "archive", label: "Archive ticket" }],
      },
      true,
    );

    expect(action?.menuItems?.map((item) => item.id)).toEqual(["archive"]);
  });
});
