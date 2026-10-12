import { expect, test } from "bun:test";
import { createMemoryRepoFiles, createMemoryStorage, makeCommandArgs } from "@pstdio/sdk/testing";
import { createFolderCommand, renameFolderCommand } from "./folder-commands";
import { listFolders } from "./folders";

test("simultaneous folder creation cannot reserve the same project name twice", async () => {
  const mount = createMemoryRepoFiles();
  const storage = createMemoryStorage();
  const overrides = { artifacts: { mount: () => mount } };
  const results = await Promise.allSettled(
    ["Research", " research "].map((title) =>
      createFolderCommand.run(...makeCommandArgs({ storage, params: { title }, overrides })),
    ),
  );
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  const failure = results.find((result) => result.status === "rejected");
  expect(failure?.status === "rejected" && failure.reason.message).toContain("already exists");
  expect(await listFolders(mount)).toHaveLength(1);
  const renamed = await renameFolderCommand.run(
    ...makeCommandArgs({
      storage,
      overrides,
      params: { folderId: (await listFolders(mount))[0].id, title: "Ideas" },
    }),
  );
  expect(renamed.title).toBe("Ideas");
});
