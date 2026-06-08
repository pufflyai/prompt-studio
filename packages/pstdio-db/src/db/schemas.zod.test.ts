import { describe, expect, it } from "bun:test";

import {
  activityEventSelectSchema,
  sessionApiSchema,
  workspaceApiSchema,
  ydocAwarenessSelectSchema,
  ydocResumeStateSelectSchema,
  ydocUpdatesSelectSchema,
} from "./schemas.zod";

describe("schemas.zod", () => {
  it("supports workspace and session API payload extensions", () => {
    const workspaceResult = workspaceApiSchema.safeParse({
      archived: false,
      branch: null,
      created_at: "2026-01-01T00:00:00.000Z",
      deleted_at: null,
      id: "workspace-1",
      initializing: false,
      is_default: false,
      setup_error: null,
      name: "Main",
      project_id: "project-1",
      anchors_json: [],
      startup_log_file_id: null,
      updated_at: "2026-01-01T00:00:00.000Z",
      workspace_shorthand: "WS001",
      worktree_path: null,
    });

    const sessionResult = sessionApiSchema.safeParse({
      agent: null,
      agent_session_id: null,
      agent_session_status: "not_connected",
      anchors_json: [],
      archived: false,
      branch: null,
      session_file_id: null,
      original_session_id: null,
      cwd: null,
      created: null,
      created_at: "2026-01-01T00:00:00.000Z",
      id: "session-1",
      last_request_ended: null,
      last_request_started: null,
      last_selected_model: null,
      project_id: "project-1",
      repo_id: null,
      status: "in_progress",
      title: "Session",
      updated_at: "2026-01-01T00:00:00.000Z",
      workspace_id: null,
      worktree_path: null,
    });

    expect(workspaceResult.success).toBe(true);
    expect(sessionResult.success).toBe(true);
  });

  it("accepts awaiting_input as a valid session status", () => {
    const result = sessionApiSchema.safeParse({
      agent: null,
      agent_session_id: null,
      agent_session_status: "not_connected",
      anchors_json: [],
      archived: false,
      branch: null,
      session_file_id: null,
      original_session_id: null,
      cwd: null,
      created: null,
      created_at: "2026-01-01T00:00:00.000Z",
      id: "session-awaiting-input",
      last_request_ended: null,
      last_request_started: null,
      last_selected_model: null,
      project_id: "project-1",
      repo_id: null,
      status: "awaiting_input",
      title: "Awaiting Input Session",
      updated_at: "2026-01-01T00:00:00.000Z",
      workspace_id: null,
      worktree_path: null,
    });

    expect(result.success).toBe(true);
  });

  it("validates ydoc update payloads", () => {
    const result = ydocUpdatesSelectSchema.safeParse({
      id: "update-1",
      projectId: "project-1",
      room: "doc-room",
      op: new Uint8Array([1, 2, 3]),
    });

    expect(result.success).toBe(true);
  });

  it("validates ydoc awareness payloads", () => {
    const result = ydocAwarenessSelectSchema.safeParse({
      clientId: "client-1",
      projectId: "project-1",
      room: "doc-room",
      op: new Uint8Array([1, 2, 3]),
      updated: "2026-01-01T00:00:00.000Z",
    });

    expect(result.success).toBe(true);
  });

  it("validates ydoc resume state payloads", () => {
    const result = ydocResumeStateSelectSchema.safeParse({
      projectId: "project-1",
      room: "doc-room",
      offset: "0",
      handle: "handle-1",
    });

    expect(result.success).toBe(true);
  });

  it("validates activity event payloads", () => {
    const result = activityEventSelectSchema.safeParse({
      id: "event-1",
      project_id: "project-1",
      resource_type: "ticket",
      resource_id: "PS-38",
      source_extension_id: null,
      event_type: "status_changed",
      actor_type: "user",
      actor_id: "user-1",
      source: "ui",
      summary: "Moved to in progress",
      payload_json: { from: "todo", to: "in_progress" },
      created_at: "2026-01-01T00:00:00.000Z",
    });

    expect(result.success).toBe(true);
  });
});
