import { describe, expect, test } from "bun:test";
import extension from "./extension";

const placementOrder = { first: 0, default: 1, last: 2 } as const;

const orderOf = (menu: { placement?: keyof typeof placementOrder }, index: number) =>
  placementOrder[menu.placement ?? "default"] * 1000 + index;

describe("pstdio planner ticket actions", () => {
  test("keeps ticket header overflow actions aligned with board row actions", () => {
    const tickets = extension.views?.find((view) => view.id === "tickets");
    const rowActions = tickets?.body.kind === "kanban" ? (tickets.body.rowActions ?? []) : [];
    const menuActions = (extension.commands ?? [])
      .flatMap((command) => command.menus ?? [])
      .map((menu, index) => ({ menu, index }))
      .filter(({ menu }) => menu.slot.id === "ticket.header-overflow")
      .sort((left, right) => orderOf(left.menu, left.index) - orderOf(right.menu, right.index))
      .map(({ menu }) => ({ label: menu.label, icon: menu.icon }));

    expect(menuActions).toEqual(rowActions.map((action) => ({ label: action.label, icon: action.icon })));
  });
});
