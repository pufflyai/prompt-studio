import { expect, test } from "bun:test";
import { getRuntimeCollections, getWriter } from "@/lib/sync/collections";
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
    expect(calls).toBe(0);
    getWriter("workspaces")!.upsert({ id: "selected-workspace", project_id: "selected" });
    getWriter("sessions")!.upsert({ id: "selected-session", project_id: "selected" });
    getWriter("workspace_sessions")!.upsert({
      id: "selected-attachment",
      workspace_id: "selected-workspace",
      session_id: "selected-session",
    });
    expect(calls).toBe(3);
    getWriter("workspace_sessions")!.remove("selected-attachment");
    expect(calls).toBe(4);
    getWriter("sessions")!.upsert({ id: "selected-session", project_id: "other" });
    expect(calls).toBe(5);
    projectId = "other";
    getWriter("sessions")!.upsert({ id: "selected-session", project_id: "other" });
    expect(calls).toBe(6);
  } finally {
    dispose();
  }
});

test("workspace subscriptions resolve linked rows in their original runtime", async () => {
  const config = Object.getOwnPropertyDescriptor(globalThis, "__PSTDIO_CONFIG__");
  const select = (name: string) => {
    Object.defineProperty(globalThis, "__PSTDIO_CONFIG__", {
      configurable: true,
      value: { apiBaseUrl: `http://${name}.invalid` },
    });
    const owner = getRuntimeCollections();
    owner.getWriter("workspaces")!.upsert({ id: "same", project_id: name });
    owner.getWriter("sessions")!.upsert({ id: "same", project_id: name });
    return owner;
  };
  const first = select("selected");
  let calls = 0;
  const unsubscribe = subscribeWorkspaceDataChanges(
    () => "selected",
    () => calls++,
  );
  const second = select("other");
  try {
    first.getWriter("workspace_sessions")!.upsert({ id: "link", workspace_id: "same", session_id: "same" });
    expect(calls).toBe(1);
    second.getWriter("workspace_sessions")!.upsert({ id: "link", workspace_id: "same", session_id: "same" });
    expect(calls).toBe(1);
  } finally {
    unsubscribe();
    await Promise.all([first.dispose(), second.dispose()]);
    if (config) Object.defineProperty(globalThis, "__PSTDIO_CONFIG__", config);
    else Reflect.deleteProperty(globalThis, "__PSTDIO_CONFIG__");
  }
});
