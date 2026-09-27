import { expect, test } from "bun:test";
import { getWriter } from "@/lib/sync/collections";
import { subscribeWorkspaceDataChanges } from "./workspace-data-subscription";

test("workspace views refresh only for changes owned by the selected project", () => {
  getWriter("workspaces")!.truncateAndWrite([
    { id: "selected-workspace", project_id: "selected" },
    { id: "other-workspace", project_id: "other" },
  ]);
  getWriter("sessions")!.truncateAndWrite([
    { id: "selected-session", project_id: "selected" },
    { id: "other-session", project_id: "other" },
  ]);
  getWriter("project_repos")!.truncateAndWrite([
    { id: "selected-link", project_id: "selected", repo_id: "selected-repo" },
    { id: "other-link", project_id: "other", repo_id: "other-repo" },
  ]);
  let projectId = "selected";
  let calls = 0;
  const dispose = subscribeWorkspaceDataChanges(
    () => projectId,
    () => calls++,
  );
  try {
    getWriter("workspaces")!.upsert({ id: "other-workspace", project_id: "other" });
    getWriter("sessions")!.upsert({ id: "other-session", project_id: "other" });
    getWriter("workspace_sessions")!.upsert({
      id: "other-attachment",
      workspace_id: "other-workspace",
      session_id: "other-session",
    });
    getWriter("repos")!.upsert({ id: "other-repo" });
    getWriter("project_repos")!.remove("other-link");
    expect(calls).toBe(0);
    getWriter("workspaces")!.upsert({ id: "selected-workspace", project_id: "selected" });
    getWriter("sessions")!.upsert({ id: "selected-session", project_id: "selected" });
    getWriter("workspace_sessions")!.upsert({
      id: "selected-attachment",
      workspace_id: "selected-workspace",
      session_id: "selected-session",
    });
    getWriter("repos")!.upsert({ id: "selected-repo" });
    getWriter("project_repos")!.remove("selected-link");
    expect(calls).toBe(5);
    getWriter("workspace_sessions")!.remove("selected-attachment");
    expect(calls).toBe(6);
    getWriter("sessions")!.upsert({ id: "selected-session", project_id: "other" });
    expect(calls).toBe(7);
    projectId = "other";
    getWriter("sessions")!.upsert({ id: "selected-session", project_id: "other" });
    expect(calls).toBe(8);
  } finally {
    dispose();
  }
});
