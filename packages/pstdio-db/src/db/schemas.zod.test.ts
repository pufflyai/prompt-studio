import { describe, expect, it } from "bun:test";

import {
  createTicketBodySchema,
  sessionApiSchema,
  ticketApiSchema,
  updateTicketBodySchema,
  workspaceApiSchema,
  ydocAwarenessSelectSchema,
  ydocResumeStateSelectSchema,
  ydocUpdatesSelectSchema,
} from "./schemas.zod";

const ticketBase = {
  archived: false,
  blocked_reason: null,
  created_at: "2026-01-01T00:00:00.000Z",
  deleted_at: null,
  depends_on: null,
  display_title: "Initial ticket",
  draft: false,
  file_id: null,
  id: "ticket-1",
  parallelizable: "yes",
  parent_id: null,
  project_id: "project-1",
  shorthand: "TK0001",
  status_id: null,
  updated_at: "2026-01-01T00:00:00.000Z",
  user_prompt: "Build the thing",
};

describe("schemas.zod", () => {
  it("validates API ticket payloads with computed fields", () => {
    const result = ticketApiSchema.safeParse({
      ...ticketBase,
      attempts: [
        {
          id: "workspace-1",
          label: "Attempt 1",
          session_id: "session-1",
          status: "active",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      sub_tickets: [
        {
          id: "ticket-2",
          shorthand: "TK0002",
          status_id: null,
          display_title: "Sub ticket",
        },
      ],
      tag_ids: ["tag-1"],
    });

    expect(result.success).toBe(true);
  });

  it("requires project_id in create ticket payloads", () => {
    const invalidResult = createTicketBodySchema.safeParse({
      display_title: "Missing project",
    });

    expect(invalidResult.success).toBe(false);

    const validResult = createTicketBodySchema.safeParse({
      project_id: "project-1",
      display_title: "Valid",
    });

    expect(validResult.success).toBe(true);
  });

  it("does not allow project_id in update ticket payloads", () => {
    const result = updateTicketBodySchema.safeParse({
      project_id: "project-1",
      display_title: "Invalid",
    });

    expect(result.success).toBe(false);
  });

  it("supports workspace and session API payload extensions", () => {
    const workspaceResult = workspaceApiSchema.safeParse({
      archived: false,
      branch: null,
      created_at: "2026-01-01T00:00:00.000Z",
      deleted_at: null,
      id: "workspace-1",
      name: "Main",
      project_id: "project-1",
      session_id: null,
      status: "active",
      startup_log_file_id: null,
      ticket_id: null,
      updated_at: "2026-01-01T00:00:00.000Z",
      workspace_shorthand: "WS001",
      worktree_path: null,
    });

    const sessionResult = sessionApiSchema.safeParse({
      agent: null,
      agent_session_id: null,
      agent_session_status: "not_connected",
      archived: false,
      branch: null,
      session_file_id: null,
      created: null,
      created_at: "2026-01-01T00:00:00.000Z",
      id: "session-1",
      last_request_ended: null,
      last_request_started: null,
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
      archived: false,
      branch: null,
      session_file_id: null,
      created: null,
      created_at: "2026-01-01T00:00:00.000Z",
      id: "session-awaiting-input",
      last_request_ended: null,
      last_request_started: null,
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
});
