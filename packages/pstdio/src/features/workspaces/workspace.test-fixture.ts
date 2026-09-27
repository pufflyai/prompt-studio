import { homedir } from "node:os";
import type { Workspace } from "@pstdio/sdk/resources";

export const makeWorkspace = (overrides: Partial<Workspace> = {}): Workspace => {
  const shorthand = overrides.workspace_shorthand ?? "PS-1_A1";
  return {
    id: "ws-1",
    project_id: "proj-1",
    name: shorthand,
    branch: `workspace/${shorthand}`,
    root_path: `${homedir()}/.pstdio/workspaces/${shorthand}`,
    provider_id: "pstdio.worktree",
    provider_params_json: {},
    provider_ref_json: {
      version: 1,
      data: { sourceRoot: "/repo", worktreeRoot: `${homedir()}/.pstdio/workspaces/${shorthand}`, relativePath: "" },
    },
    provider_state: "ready",
    execution_kind: "local",
    provider_operation_id: null,
    provider_operation_kind: null,
    provider_error_json: null,
    provider_capabilities_json: {
      files: "write",
      diff: true,
      merge: true,
      rebase: true,
      archive: true,
      delete: true,
    },
    display_path: null,
    is_default: false,
    archived: false,
    initializing: false,
    setup_error: null,
    workspace_shorthand: shorthand,
    startup_log_file_id: null,
    anchors_json: [],
    created_at: "2026-03-05T00:00:00.000Z",
    updated_at: "2026-03-05T00:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
};
