import { expect, test } from "bun:test";
import { createWorkbench } from "../../core";
import { createWorkbenchWebviewHostCapabilities } from "./webview-host-capabilities";

test("only the active page extension can update its params", () => {
  const workbench = createWorkbench();
  const page = { kind: "page" as const, id: "board", extensionId: "acme.a" };
  workbench.modes.registerMode({ id: "project", activate: () => undefined });
  workbench.views.registerView({ id: "board", title: "Board", body: { kind: "react", render: () => null } });
  workbench.pages.registerPage({
    id: "board",
    ref: page,
    path: "board",
    modeId: "project",
    params: { range: { type: "string", default: "now-1h" } },
    main: { kind: "view", view: { kind: "view", id: "board" }, cardinality: "one" },
    slots: [],
  });
  const owner = createWorkbenchWebviewHostCapabilities({ workbench, extensionId: "acme.a" });
  const other = createWorkbenchWebviewHostCapabilities({ workbench, extensionId: "acme.b" });
  expect(() => owner["page.params.update"]({ params: {} })).toThrow("page_params_no_page");
  workbench.pageLocations.setProject("p1");
  workbench.pageLocations.navigate({ kind: "page", page });
  const location = workbench.pages.store.getState().location;
  expect(() => other["page.params.update"]({ params: { range: "now-6h" } })).toThrow("page_params_not_owner");
  expect(workbench.pages.store.getState().location).toBe(location);
  expect(owner["page.params.update"]({ params: { range: "now-6h" } })).toMatchObject({
    location: { params: { range: "now-6h" } },
  });
});
