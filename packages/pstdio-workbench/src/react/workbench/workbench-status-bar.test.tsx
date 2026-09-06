import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createWorkbench, getWorkbenchRenderers } from "../../core";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { WorkbenchStatusBar } from "./workbench-panels";

describe("WorkbenchStatusBar", () => {
  test("renders a View-backed status item without a layout panel registration", () => {
    const workbench = createWorkbench();
    workbench.views.registerView({
      id: "sync.connection",
      title: "Connection",
      body: { kind: "react", render: () => <span>Connected</span> },
    });
    workbench.statusBar.registerItem({
      id: "sync.connection.item",
      viewId: "sync.connection",
      slot: "leading",
    });
    expect(getWorkbenchRenderers(workbench).getRenderer("sync.connection")).toBeDefined();

    const markup = renderToStaticMarkup(
      <WorkbenchThemeProvider>
        <WorkbenchStatusBar workbench={workbench} />
      </WorkbenchThemeProvider>,
    );

    expect(markup).toContain("Connected");
  });
});
