import { describe, expect, it } from "bun:test";
import type { ApiWorkspaceArtifact } from "../../ticket-list/data/api/types";
import { buildWorkspaceChecksContentRequest } from "./workspace-checks-content-request";

const makeArtifact = (input: { id: string; fileId: string; updatedAt: string }): ApiWorkspaceArtifact => ({
  id: input.id,
  file_id: input.fileId,
  file_name: `${input.id}.log`,
  file_kind: "artifact",
  relative_path: `artifacts/${input.id}.log`,
  mime_type: "text/plain",
  size_bytes: 100,
  created_at: "2026-04-17T00:00:00.000Z",
  updated_at: input.updatedAt,
});

describe("buildWorkspaceChecksContentRequest", () => {
  it("uses selected artifact metadata to build refresh key", () => {
    const artifacts = [
      makeArtifact({ id: "lint", fileId: "file-1", updatedAt: "2026-04-17T10:00:00.000Z" }),
      makeArtifact({ id: "test", fileId: "file-2", updatedAt: "2026-04-17T11:00:00.000Z" }),
    ];

    const request = buildWorkspaceChecksContentRequest(artifacts, "test");

    expect(request.selectedArtifact?.id).toBe("test");
    expect(request.refreshKey).toBe("file-2:2026-04-17T11:00:00.000Z");
  });

  it("changes refresh key when synced artifact updated_at changes", () => {
    const before = [makeArtifact({ id: "lint", fileId: "file-1", updatedAt: "2026-04-17T10:00:00.000Z" })];
    const after = [makeArtifact({ id: "lint", fileId: "file-1", updatedAt: "2026-04-17T10:05:00.000Z" })];

    const beforeRequest = buildWorkspaceChecksContentRequest(before, "lint");
    const afterRequest = buildWorkspaceChecksContentRequest(after, "lint");

    expect(afterRequest.selectedArtifact?.id).toBe("lint");
    expect(beforeRequest.refreshKey).not.toBe(afterRequest.refreshKey);
  });
});
