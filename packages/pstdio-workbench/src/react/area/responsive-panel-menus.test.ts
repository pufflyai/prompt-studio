import { describe, expect, test } from "bun:test";
import type { PanelMenuDetails } from "../../core";
import { resolveResponsivePanelMenus } from "./responsive-panel-menus";

const menu = (side: "left" | "right", sizePx = 110): PanelMenuDetails => ({
  key: `menu:main:${side}`,
  binding: { host: "editor", side, icon: "panel", sizePx },
  placement: { widgetId: side, contributionId: side },
  widget: {
    id: side,
    title: side,
    area: "main",
    rendererId: side,
    singleton: true,
    reuse: "none",
    source: "module",
    ownerId: "test",
    priority: 0,
  },
});

describe("resolveResponsivePanelMenus", () => {
  test("keeps attached menus docked when the panel can preserve its content", () => {
    const left = menu("left");
    const right = menu("right");

    expect(resolveResponsivePanelMenus({ left, right, widthPx: 700 })).toEqual({
      docked: { left, right },
      collapsed: [],
    });
  });

  test("collapses attached menus into header dropdowns when the panel is small", () => {
    const left = menu("left");
    const right = menu("right");

    expect(resolveResponsivePanelMenus({ left, right, widthPx: 500 })).toEqual({
      docked: { left: undefined, right: undefined },
      collapsed: [left, right],
    });
  });
});
