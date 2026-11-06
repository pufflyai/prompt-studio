import { expect, test } from "bun:test";
import { createWorkbench } from "../../core";
import { resolveWebviewPageProps } from "./webview-page-props";

test("bound webviews read their page's defaults and params instead of Main's", () => {
  const workbench = createWorkbench();
  const page = { kind: "page" as const, id: "form", extensionId: "acme.tools" };
  workbench.modes.registerMode({ id: "project", activate: () => undefined });
  workbench.views.registerView({ id: "form", title: "Form", body: { kind: "react", render: () => null } });
  workbench.pages.registerPage({
    id: "form",
    ref: page,
    path: "form",
    modeId: "project",
    params: { name: { type: "string", default: "New" }, limited: { type: "boolean", default: true } },
    main: { kind: "view", view: { kind: "view", id: "form" }, cardinality: "one" },
    slots: [],
  });
  const resource = { type: "folder", id: "one" };
  const props = resolveWebviewPageProps(workbench.pages.store.getState(), {
    resource,
    pageContext: { page, params: { name: "Draft" } },
  });
  expect(props).toEqual({
    pageLocation: { page, resource, params: { name: "Draft" } },
    pageParams: { name: "Draft", limited: true },
  });
  expect(resolveWebviewPageProps(workbench.pages.store.getState()).pageLocation).toBeUndefined();
});
