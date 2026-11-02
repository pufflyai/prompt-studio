import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createWorkbench } from "../../core";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { EmptyPanel } from "./empty-panel";

test("an idle empty panel renders its cards without reading numbered shortcut geometry", () => {
  const workbench = createWorkbench({ initialSidePanelMode: "attached" });
  workbench.layout.registerPanel({
    id: "available-tool",
    title: "Available tool",
    region: "side",
    rendererId: "tool",
    eligibleLocations: {},
  });
  workbench.keyboard.registerEmptyPanel("side", () => {
    throw new Error("Idle cards must not measure numbered shortcuts");
  });
  const markup = renderToStaticMarkup(
    <WorkbenchThemeProvider>
      <EmptyPanel workbench={workbench} region="side" />
    </WorkbenchThemeProvider>,
  );
  expect(markup).toContain('aria-label="Available tool"');
});
