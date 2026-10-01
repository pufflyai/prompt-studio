import { describe, expect, test } from "bun:test";
import { getWorkbenchPanelMenuAttachment } from "./panel-menu-sizing";

const menu = (open = true, minSize = 400, collapsible = true) => ({ has: true, open, minSize, collapsible });

describe("panel menu attachment", () => {
  test("floats closable menus in panels 480 px wide or narrower", () => {
    expect(getWorkbenchPanelMenuAttachment(480, [menu(true, 144)])).toEqual([false]);
    expect(getWorkbenchPanelMenuAttachment(481, [menu(true, 144)])).toEqual([true]);
    expect(getWorkbenchPanelMenuAttachment(300, [menu(true, 144, false)])).toEqual([true]);
  });
  test("attaches when the configured menu width, resize handle, and content fit", () => {
    expect(getWorkbenchPanelMenuAttachment(521, [menu()])).toEqual([true]);
    expect(getWorkbenchPanelMenuAttachment(520, [menu()])).toEqual([false]);
  });
  test("lets a closed menu reopen as attached when there is room", () => {
    expect(getWorkbenchPanelMenuAttachment(521, [menu(false)])).toEqual([true]);
  });
  test("reserves space for each open menu and its resize handle", () => {
    expect(getWorkbenchPanelMenuAttachment(922, [menu(), menu()])).toEqual([true, true]);
    expect(getWorkbenchPanelMenuAttachment(921, [menu(), menu()])).toEqual([true, false]);
  });
  test("closed and absent menus do not reserve attached width", () => {
    expect(getWorkbenchPanelMenuAttachment(521, [menu(false), menu()])).toEqual([false, true]);
    expect(getWorkbenchPanelMenuAttachment(521, [{ ...menu(), has: false }, menu()])).toEqual([false, true]);
  });
  test("reserves noncollapsible menus before optional menus", () => {
    expect(getWorkbenchPanelMenuAttachment(921, [menu(), menu(true, 400, false)])).toEqual([false, true]);
  });
  test("keeps open menus attached until panel width is measured", () => {
    expect(getWorkbenchPanelMenuAttachment(0, [menu(), menu(false)])).toEqual([true, false]);
  });
});
