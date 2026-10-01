import { describe, expect, test } from "bun:test";
import { getWorkbenchPanelMenuAttachment } from "./panel-menu-sizing";

const menu = (open = true, minSize = 500, collapsible = true) => ({ has: true, open, minSize, collapsible });

describe("panel menu attachment", () => {
  test("floats closable menus in panels 580 px wide or narrower", () => {
    expect(getWorkbenchPanelMenuAttachment(580, [menu(true, 144)])).toEqual([false]);
    expect(getWorkbenchPanelMenuAttachment(581, [menu(true, 144)])).toEqual([true]);
    expect(getWorkbenchPanelMenuAttachment(300, [menu(true, 144, false)])).toEqual([true]);
  });
  test("attaches when the configured menu width, resize handle, and content fit", () => {
    expect(getWorkbenchPanelMenuAttachment(621, [menu()])).toEqual([true]);
    expect(getWorkbenchPanelMenuAttachment(620, [menu()])).toEqual([false]);
  });
  test("lets a closed menu reopen as attached when there is room", () => {
    expect(getWorkbenchPanelMenuAttachment(621, [menu(false)])).toEqual([true]);
  });
  test("reserves space for each open menu and its resize handle", () => {
    expect(getWorkbenchPanelMenuAttachment(1122, [menu(), menu()])).toEqual([true, true]);
    expect(getWorkbenchPanelMenuAttachment(1121, [menu(), menu()])).toEqual([true, false]);
  });
  test("closed and absent menus do not reserve attached width", () => {
    expect(getWorkbenchPanelMenuAttachment(621, [menu(false), menu()])).toEqual([false, true]);
    expect(getWorkbenchPanelMenuAttachment(621, [{ ...menu(), has: false }, menu()])).toEqual([false, true]);
  });
  test("reserves noncollapsible menus before optional menus", () => {
    expect(getWorkbenchPanelMenuAttachment(1121, [menu(), menu(true, 500, false)])).toEqual([false, true]);
  });
  test("keeps open menus attached until panel width is measured", () => {
    expect(getWorkbenchPanelMenuAttachment(0, [menu(), menu(false)])).toEqual([true, false]);
  });
});
