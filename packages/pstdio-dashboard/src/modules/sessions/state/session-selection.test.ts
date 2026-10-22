import { expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { getCollection, getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { getDashboardSelectedSession, rememberDashboardSessionResource } from "./session-selection";

test("selecting one session uses its keyed row and respects the selected project", () => {
  const workbench = createWorkbench();
  const writer = getWriter("sessions")!;
  writer.upsert({ id: "selected-keyed", title: "Selected", project_id: "selected-project" });
  selectDashboardProject(workbench, { id: "selected-project", name: "Project" });
  rememberDashboardSessionResource(workbench, { type: "session", id: "selected-keyed" });
  const sessions = getCollection("sessions");
  const descriptor = Object.getOwnPropertyDescriptor(sessions, "values");
  Object.defineProperty(sessions, "values", {
    configurable: true,
    value: () => {
      throw new Error("Unrelated sessions enumerated");
    },
  });
  try {
    expect(getDashboardSelectedSession(workbench)?.title).toBe("Selected");
    selectDashboardProject(workbench, { id: "other-project", name: "Other" });
    expect(getDashboardSelectedSession(workbench)).toBeUndefined();
  } finally {
    if (descriptor) Object.defineProperty(sessions, "values", descriptor);
    else Reflect.deleteProperty(sessions, "values");
    writer.remove("selected-keyed");
    workbench.dispose();
  }
});
