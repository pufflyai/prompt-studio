import { expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import {
  clearDashboardProjectSelection,
  getDashboardSelectedProjectId,
  getDashboardSelectedProjectName,
  selectDashboardProject,
} from "./project-context";

test("project selection observers receive a matching identity and name", () => {
  const workbench = createWorkbench();
  selectDashboardProject(workbench, { id: "a", name: "Project A" });
  const seen: (string | undefined)[][] = [];
  const stop = workbench.context.store.subscribe(() => {
    seen.push([getDashboardSelectedProjectId(workbench), getDashboardSelectedProjectName(workbench)]);
  });
  selectDashboardProject(workbench, { id: "b", name: "Project B" });
  expect(seen).toEqual([["b", "Project B"]]);
  seen.length = 0;
  clearDashboardProjectSelection(workbench);
  expect(seen).toEqual([[undefined, undefined]]);
  stop();
});
