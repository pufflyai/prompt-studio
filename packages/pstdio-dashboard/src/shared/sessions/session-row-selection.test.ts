import { describe, expect, it } from "bun:test";
import type { SyncedRow } from "@/features/sync/collections";
import { findSessionRow } from "./session-row-selection";

const row = (input: { id: string; projectId: string }): SyncedRow => ({
  id: input.id,
  project_id: input.projectId,
});

describe("findSessionRow", () => {
  it("finds a selected session without requiring route project params", () => {
    const session = findSessionRow([row({ id: "session-1", projectId: "project-1" })], {
      sessionId: "session-1",
      projectId: undefined,
    });

    expect(session?.id).toBe("session-1");
  });

  it("keeps project-scoped lookups inside the current project when provided", () => {
    const session = findSessionRow([row({ id: "session-1", projectId: "project-1" })], {
      sessionId: "session-1",
      projectId: "project-2",
    });

    expect(session).toBeUndefined();
  });
});
