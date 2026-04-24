import { describe, expect, it } from "bun:test";
import type { SessionDto } from "../data/mappers";
import { createStopSessionMutationOptions } from "./use-stop-session";

describe("createStopSessionMutationOptions", () => {
  it("updates the synced session row when stop succeeds", () => {
    const upserts: unknown[] = [];
    const row: SessionDto = {
      id: "session-1",
      project_id: "project-1",
      agent_session_id: "agent-session-1",
      title: "Build feature",
      status: "cancelled",
      archived: false,
      agent: "opencode",
      created_at: "2026-04-24T12:00:00.000Z",
      updated_at: "2026-04-24T12:01:00.000Z",
    };

    const options = createStopSessionMutationOptions({
      upsert: (session) => upserts.push(session),
    });
    options.onSuccess?.(row);

    expect(upserts).toEqual([row]);
  });
});
