import { describe, expect, it } from "bun:test";
import type { ApiWorkspaceArtifact } from "@/features/ticket-list/data/api/types";
import { resolveSelectedArtifact } from "./artifact-selection";

const makeArtifact = (id: string, fileId = `file-${id}`): ApiWorkspaceArtifact => ({
  id,
  file_id: fileId,
  file_name: `${id}.log`,
  file_kind: "artifact",
  relative_path: `artifacts/${id}.log`,
  mime_type: "text/plain",
  size_bytes: 100,
  created_at: "2026-04-09T00:00:00.000Z",
});

describe("resolveSelectedArtifact", () => {
  it("returns null when artifacts list is empty", () => {
    expect(resolveSelectedArtifact([], null)).toBe(null);
  });

  it("selects the first artifact when no current selection", () => {
    const artifacts = [makeArtifact("a1"), makeArtifact("a2")];
    expect(resolveSelectedArtifact(artifacts, null)).toBe("a1");
  });

  it("preserves current selection when it still exists in the list", () => {
    const artifacts = [makeArtifact("a1"), makeArtifact("a2")];
    expect(resolveSelectedArtifact(artifacts, "a2")).toBe("a2");
  });

  it("resets to first artifact when current selection no longer exists", () => {
    const artifacts = [makeArtifact("a1"), makeArtifact("a2")];
    expect(resolveSelectedArtifact(artifacts, "gone")).toBe("a1");
  });

  it("returns null when artifacts become empty and had a previous selection", () => {
    expect(resolveSelectedArtifact([], "a1")).toBe(null);
  });
});
