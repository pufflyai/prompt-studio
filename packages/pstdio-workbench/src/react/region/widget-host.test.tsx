import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createWorkbench } from "../../core";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { WorkbenchWidgetHost } from "./widget-host";

describe("WorkbenchWidgetHost", () => {
  test("renders the View selected by the placement instead of the slot fallback", () => {
    const workbench = createWorkbench();
    workbench.views.registerView({
      id: "workspace.list",
      title: "Workspaces",
      body: { kind: "react", render: () => <span>Workspace list</span> },
    });
    workbench.views.registerView({
      id: "workspace.changes",
      title: "Changes",
      body: { kind: "react", render: () => <span>Workspace changes</span> },
    });

    const markup = renderToStaticMarkup(
      <WorkbenchThemeProvider>
        <WorkbenchWidgetHost
          workbench={workbench}
          widget={{
            id: "workspace-page.primary",
            title: "Workspaces",
            region: "main",
            rendererId: "workspace.list",
            source: "module",
            ownerId: "host",
            priority: 0,
          }}
          placement={{
            widgetId: "workspace-page.primary:workspace-1",
            contributionId: "workspace-page.primary",
            viewId: "workspace.changes",
            title: "Changes",
          }}
        />
      </WorkbenchThemeProvider>,
    );

    expect(markup).toContain("Workspace changes");
    expect(markup).not.toContain("Workspace list");
  });
});
