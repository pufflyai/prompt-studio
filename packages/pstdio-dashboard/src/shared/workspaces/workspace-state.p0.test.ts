import { expect, test } from "bun:test";
import { getCollection, getWriter } from "@/lib/sync/collections";
import { isProjectWorkspaceReady, workspaceState } from "./workspace-state";

test("folder setup is ready only after successful initialization", () => {
  const folder = { provider_state: "ready", execution_kind: "local", root_path: "/notes", is_default: true };
  expect(workspaceState(folder)).toBe("ready");
  expect(workspaceState({ ...folder, initializing: true })).toBe("provisioning");
  expect(workspaceState({ ...folder, setup_error: "Cannot write config" })).toBe("failed");
  expect(workspaceState({ ...folder, root_path: null })).toBe("unattached");
  expect(workspaceState({ provider_state: "ready", execution_kind: "remote", root_path: null })).toBe("ready");
});

test("a ready folder on another device cannot make this device's project ready", () => {
  const previous = [...getCollection("workspaces").state.values()];
  const local = { id: "local", project_id: "cloud", is_default: true, root_path: null };
  const otherDevice = {
    id: "other",
    project_id: "cloud",
    is_default: true,
    root_path: "/other-machine/project",
    device: { id: "other-device", ownerId: "owner", name: "Other machine" },
  };
  try {
    getWriter("workspaces")?.truncateAndWrite([otherDevice, local]);
    expect(isProjectWorkspaceReady("cloud")).toBe(false);
    getWriter("workspaces")?.truncateAndWrite([otherDevice, { ...local, root_path: "/this-machine/project" }]);
    expect(isProjectWorkspaceReady("cloud")).toBe(true);
    getWriter("workspaces")?.truncateAndWrite([otherDevice]);
    expect(isProjectWorkspaceReady("cloud")).toBe(false);
  } finally {
    getWriter("workspaces")?.truncateAndWrite(previous);
  }
});
