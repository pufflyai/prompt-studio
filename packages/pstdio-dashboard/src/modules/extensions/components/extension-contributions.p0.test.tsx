import { expect, test } from "bun:test";
import { emptyDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { buildContributionGroups } from "./extension-contributions";

test("workspace providers appear in the contribution inventory under their owning extension", () => {
  const metadata = {
    ...emptyDashboardExtensionMetadata,
    workspaceTypes: [
      {
        id: "pstdio.workspaces.workspace-type.git",
        localId: "git",
        extensionId: "pstdio.workspaces",
        label: "Git worktree",
        icon: "git-branch",
      },
      { id: "other.cloud.workspace-type.remote", localId: "remote", extensionId: "other.cloud", label: "Cloud" },
    ],
  };
  expect(buildContributionGroups(metadata, "pstdio.workspaces")).toEqual([
    expect.objectContaining({
      key: "workspaceTypes",
      rows: [{ id: "pstdio.workspaces.workspace-type.git", title: "Git worktree", meta: undefined }],
    }),
  ]);
});
