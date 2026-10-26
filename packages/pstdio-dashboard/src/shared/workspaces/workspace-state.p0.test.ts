import { expect, test } from "bun:test";
import { workspaceState } from "./workspace-state";

test("folder setup is ready only after successful initialization", () => {
  const folder = { provider_state: "ready", execution_kind: "local", root_path: "/notes", is_default: true };
  expect(workspaceState(folder)).toBe("ready");
  expect(workspaceState({ ...folder, initializing: true })).toBe("provisioning");
  expect(workspaceState({ ...folder, setup_error: "Cannot write config" })).toBe("failed");
  expect(workspaceState({ ...folder, root_path: null })).toBe("unattached");
  expect(workspaceState({ provider_state: "ready", execution_kind: "remote", root_path: null })).toBe("ready");
});
