import { expect, test } from "bun:test";
import { createWorkbenchCore } from "../../core";
import { createBreadcrumbModule } from "./breadcrumb-module";

test("coexists with a host session resource kind", () => {
  const workbench = createWorkbenchCore();
  workbench.resources.registerKind({ kind: "session", label: "Host session" });

  expect(() => workbench.registerModule(createBreadcrumbModule())).not.toThrow();
  expect(workbench.resources.getKind("session")?.label).toBe("Host session");
  expect(workbench.breadcrumbs.getItems()?.map((item) => item.title)).toEqual(["Docs", "Concepts", "Regions"]);
});
