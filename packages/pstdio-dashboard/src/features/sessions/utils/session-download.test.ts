import { describe, expect, it } from "bun:test";
import type { Session } from "../types";
import { buildSessionDownload } from "./session-download";

const session: Session = {
  id: "session-123",
  projectId: "project-1",
  title: "Fix flaky tests",
  status: "completed",
  archived: false,
  agent: "claude-code",
  createdAt: "2026-02-20T10:00:00.000Z",
  updatedAt: "2026-02-21T12:00:00.000Z",
};

describe("buildSessionDownload", () => {
  it("returns a readable file name that includes title and id", () => {
    const download = buildSessionDownload(session);

    expect(download.fileName).toBe("fix-flaky-tests-session-123.json");
  });

  it("returns formatted JSON with the full session payload", () => {
    const download = buildSessionDownload(session);

    expect(download.content).toBe(JSON.stringify(session, null, 2));
  });
});
