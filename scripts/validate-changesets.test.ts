import { describe, expect, it } from "bun:test";
import { collectChangesetValidationIssues } from "./validate-changesets";

const changesetWithoutSdk = {
  ".changeset/basic.md": `---
"pstdio": patch
---

Test summary.
`,
};

describe("collectChangesetValidationIssues", () => {
  it("does not require @pstdio/sdk for sdk test-only changes", async () => {
    const issues = await collectChangesetValidationIssues(changesetWithoutSdk, [
      "packages/sdk/src/plugins/helpers/run-command.test.ts",
    ]);

    expect(issues).toEqual([]);
  });

  it("requires @pstdio/sdk for sdk runtime changes", async () => {
    const issues = await collectChangesetValidationIssues(changesetWithoutSdk, [
      "packages/sdk/src/plugins/helpers/run-command.ts",
    ]);

    expect(issues).toContainEqual({
      filePath: ".changeset",
      message: "changes to packages/sdk/** require an @pstdio/sdk changeset entry",
    });
  });
});
