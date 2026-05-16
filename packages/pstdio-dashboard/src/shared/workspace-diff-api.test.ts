import { afterEach, describe, expect, it } from "bun:test";
import { getWorkspaceDiffFiles } from "./workspace-diff-api";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("getWorkspaceDiffFiles", () => {
  it("loads the full workspace diff in one request", async () => {
    let requestedUrl = "";
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
      requestedUrl = String(input);

      return Response.json({
        workspace_id: "workspace-1",
        base_ref: "main",
        head_ref: "feature",
        files: [
          {
            filePath: "src/app.ts",
            change: "modified",
            additions: 1,
            deletions: 1,
            oldContent: "before\n",
            newContent: "after\n",
          },
        ],
        totals: { additions: 1, deletions: 1, file_count: 1 },
      });
    }) as typeof fetch;

    const diff = await getWorkspaceDiffFiles("workspace-1", "fork_point");

    expect(requestedUrl).toBe("/v1/workspaces/workspace-1/diff?mode=fork_point");
    expect(diff.files[0].oldContent).toBe("before\n");
    expect(diff.files[0].newContent).toBe("after\n");
  });
});
