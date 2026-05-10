import { describe, expect, it } from "bun:test";
import { ATTEMPT_DIFF_MODE } from "@/shared/workspace-diff-api";
import { buildDiffInvalidationQueryKeys, buildDiffInvalidationRequests } from "./use-invalidate-diff-on-edits";

describe("buildDiffInvalidationQueryKeys", () => {
  it("includes file metadata and summary totals queries", () => {
    expect(buildDiffInvalidationQueryKeys("workspace-1")).toEqual({
      files: ["ticket-attempt-diff-files", "workspace-1", ATTEMPT_DIFF_MODE],
      summary: ["ticket-attempt-diff-summary", "workspace-1", ATTEMPT_DIFF_MODE],
    });
  });

  it("uses fork-point mode for both invalidation fetches", () => {
    expect(buildDiffInvalidationRequests("workspace-1")).toEqual({
      files: {
        queryKey: ["ticket-attempt-diff-files", "workspace-1", ATTEMPT_DIFF_MODE],
        mode: ATTEMPT_DIFF_MODE,
      },
      summary: {
        queryKey: ["ticket-attempt-diff-summary", "workspace-1", ATTEMPT_DIFF_MODE],
        mode: ATTEMPT_DIFF_MODE,
      },
    });
  });
});
