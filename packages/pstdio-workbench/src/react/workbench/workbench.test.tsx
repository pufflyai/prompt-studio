import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createWorkbench } from "../../core";
import { isSidePanelAttached, resolveActiveSidePanelSlot, Workbench } from "./workbench";

describe("Workbench", () => {
  test("owns the UI theme providers needed by the React shell", () => {
    const markup = renderToStaticMarkup(<Workbench workbench={createWorkbench()} />);

    expect(markup.length).toBeGreaterThan(0);
  });

  test("keeps a floating Side Panel in the attached host while floating chrome is suppressed", () => {
    const attachedSlot = {} as HTMLDivElement;
    const floatingSlot = {} as HTMLDivElement;

    expect(
      resolveActiveSidePanelSlot({
        floatingPanelsAllowed: false,
        mounted: true,
        mode: "floating",
        attachedSlot,
        floatingSlot,
      }),
    ).toBe(attachedSlot);
  });

  test("reserves attached space when the page suppresses floating panels", () => {
    expect(isSidePanelAttached("floating", false)).toBe(true);
    expect(isSidePanelAttached("floating", true)).toBe(false);
    expect(isSidePanelAttached("closed", false)).toBe(false);
    expect(isSidePanelAttached("attached", true)).toBe(true);
  });
});
