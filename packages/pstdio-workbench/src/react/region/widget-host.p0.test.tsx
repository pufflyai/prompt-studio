import { describe, expect, test } from "bun:test";
import { createMemoryActivity } from "@pstdio/sdk/testing";
import { renderToStaticMarkup } from "react-dom/server";
import { createWorkbench } from "../../core";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { WorkbenchWidgetHost } from "./widget-host";

describe("WorkbenchWidgetHost", () => {
  test.each([
    { title: "resource document", document: undefined, tree: false, auxiliary: false, activity: true },
    { title: "attached document", document: "summary", tree: false, auxiliary: false, activity: false },
    { title: "resource navigation", document: undefined, tree: true, auxiliary: false, activity: false },
    { title: "auxiliary view moved into Main", document: undefined, tree: false, auxiliary: true, activity: false },
  ])("$title scopes Activity to the resource document", ({ document, tree, auxiliary, activity }) => {
    const workbench = createWorkbench();
    workbench.modes.registerMode({ id: "project", label: "Project", activate() {} });
    workbench.resources.registerKind({
      kind: "note",
      extensionId: "example.notes",
      label: "Note",
      activity: { capabilities: { comments: true }, api: createMemoryActivity(), watch: async () => {} },
    });
    workbench.views.registerView({
      id: "content",
      title: "Content",
      body: tree
        ? { kind: "tree", getBody: () => [], getChildren: () => [] }
        : { kind: "react", render: () => <span>Document</span> },
    });
    workbench.views.registerView({
      id: "attention",
      title: "Attention",
      body: { kind: "react", render: () => <span>Requests</span> },
    });
    workbench.pages.registerPage({
      id: "detail",
      ref: { kind: "page", extensionId: "example.notes", id: "detail" },
      path: "detail",
      parentId: "notes",
      modeId: "project",
      document: { metadataKey: "selectedFile" },
      resource: { kinds: [{ kind: "resource-kind", extensionId: "example.notes", id: "note" }] },
      main: { kind: "view", view: { kind: "view", id: "content" }, cardinality: "one" },
      slots: [],
    });
    const markup = renderToStaticMarkup(
      <WorkbenchThemeProvider>
        <WorkbenchWidgetHost
          workbench={workbench}
          region="main"
          placement={{
            widgetId: "content:note",
            contributionId: "content",
            viewId: auxiliary ? "attention" : "content",
            resource: {
              type: "note",
              extensionId: "example.notes",
              id: "note",
              ...(document ? { metadata: { selectedFile: document } } : {}),
            },
          }}
        />
      </WorkbenchThemeProvider>,
    );
    expect(markup.includes('aria-label="Resource activity"')).toBe(activity);
  });
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
