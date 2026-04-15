import { describe, expect, it } from "bun:test";
import type { ApiWorkspaceArtifact } from "@/features/ticket-list/data/api/types";
import { resolveSelectedArtifactFileId, resolveWorkspacePanelTab } from "./workspace-diff-panel.utils";

const createArtifact = (fileId: string): ApiWorkspaceArtifact => ({
  id: `artifact-${fileId}`,
  file_id: fileId,
  file_name: `${fileId}.log`,
  file_kind: "artifact",
  relative_path: `artifacts/${fileId}.log`,
  mime_type: "text/plain",
  size_bytes: 128,
  created_at: "2026-04-11T00:00:00.000Z",
});

describe("resolveSelectedArtifactFileId", () => {
  it("returns null when no artifacts are available", () => {
    expect(resolveSelectedArtifactFileId([], null)).toBeNull();
  });

  it("defaults to the first artifact when nothing is selected", () => {
    const artifacts = [createArtifact("lint"), createArtifact("tests")];

    expect(resolveSelectedArtifactFileId(artifacts, null)).toBe("lint");
  });

  it("keeps the selected artifact when it is still available", () => {
    const artifacts = [createArtifact("lint"), createArtifact("tests")];

    expect(resolveSelectedArtifactFileId(artifacts, "tests")).toBe("tests");
  });

  it("falls back to the first artifact when selection disappears", () => {
    const artifacts = [createArtifact("lint"), createArtifact("tests")];

    expect(resolveSelectedArtifactFileId(artifacts, "build")).toBe("lint");
  });
});

describe("resolveWorkspacePanelTab", () => {
  it("defaults to checks when there are no diffs", () => {
    expect(resolveWorkspacePanelTab({ hasDiffs: false, hasUserSelectedTab: false, activeTab: "changes" })).toBe(
      "checks",
    );
  });

  it("defaults to changes when diffs are present", () => {
    expect(resolveWorkspacePanelTab({ hasDiffs: true, hasUserSelectedTab: false, activeTab: "checks" })).toBe(
      "changes",
    );
  });

  it("keeps user-selected checks even when artifacts are empty and diffs exist", () => {
    expect(resolveWorkspacePanelTab({ hasDiffs: true, hasUserSelectedTab: true, activeTab: "checks" })).toBe("checks");
  });

  it("keeps user-selected changes when diffs are removed after mount", () => {
    expect(resolveWorkspacePanelTab({ hasDiffs: false, hasUserSelectedTab: true, activeTab: "changes" })).toBe(
      "changes",
    );
  });
});
