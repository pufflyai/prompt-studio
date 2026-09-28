import { describe, expect, mock, test } from "bun:test";
import { resolveExtensionReleaseCommit } from "./extension-release-ref";

describe("extension release refs", () => {
  test("resolves an annotated release tag to its commit", async () => {
    const releaseCommit = "b".repeat(40);
    const run = mock(async () => ({
      exitCode: 0,
      stderr: "",
      stdout: `${"a".repeat(40)}\trefs/tags/pstdio@0.27.0\n${releaseCommit}\trefs/tags/pstdio@0.27.0^{}\n`,
    }));

    expect(await resolveExtensionReleaseCommit("https://example.com/extensions.git", "pstdio@0.27.0", run)).toBe(
      releaseCommit,
    );
    expect(run).toHaveBeenCalledWith(
      "git",
      expect.arrayContaining(["https://example.com/extensions.git"]),
      expect.any(Object),
    );
  });
});
