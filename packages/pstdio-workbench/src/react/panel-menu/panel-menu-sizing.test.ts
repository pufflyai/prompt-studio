import { describe, expect, test } from "bun:test";
import { getWorkbenchPanelMenuAttachment } from "./panel-menu-sizing";

const menu = (open = true, minSize = 144, collapsible = true) => ({ has: true, open, minSize, collapsible });

describe("panel menu attachment", () => {
  test("attaches below 480 px when menu and content fit", () => {
    expect(getWorkbenchPanelMenuAttachment(265, [menu()])).toEqual([true]);
    expect(getWorkbenchPanelMenuAttachment(264, [menu()])).toEqual([false]);
  });
  test("lets a closed menu reopen as attached when there is room", () => {
    expect(getWorkbenchPanelMenuAttachment(265, [menu(false)])).toEqual([true]);
  });
  test("reserves space for each open menu and its resize handle", () => {
    expect(getWorkbenchPanelMenuAttachment(410, [menu(), menu()])).toEqual([true, true]);
    expect(getWorkbenchPanelMenuAttachment(409, [menu(), menu()])).toEqual([true, false]);
  });
  test("closed and absent menus do not reserve attached width", () => {
    expect(getWorkbenchPanelMenuAttachment(265, [menu(false), menu()])).toEqual([false, true]);
    expect(getWorkbenchPanelMenuAttachment(265, [{ ...menu(), has: false }, menu()])).toEqual([false, true]);
  });
  test("uses configured menu widths and restores attachment after resizing", () => {
    expect(getWorkbenchPanelMenuAttachment(400, [menu(true, 280)])).toEqual([false]);
    expect(getWorkbenchPanelMenuAttachment(401, [menu(true, 280)])).toEqual([true]);
  });
  test("reserves noncollapsible menus before optional menus", () => {
    expect(getWorkbenchPanelMenuAttachment(409, [menu(), menu(true, 144, false)])).toEqual([false, true]);
  });
  test("keeps open menus attached until panel width is measured", () => {
    expect(getWorkbenchPanelMenuAttachment(0, [menu(), menu(false)])).toEqual([true, false]);
  });
});
