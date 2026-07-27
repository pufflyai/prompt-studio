import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createWorkbenchCore } from "../../core";
import { resolveActiveSidePanelSlot, Workbench } from "./workbench";

describe("Workbench", () => {
  test("owns the UI theme providers needed by the React shell", () => {
    const markup = renderToStaticMarkup(<Workbench workbench={createWorkbenchCore()} />);

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
});
