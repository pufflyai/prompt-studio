import { expect, test } from "bun:test";
import { createMemoryRepoFiles, createMemoryStorage, makeCommandArgs } from "@pstdio/sdk/testing";
import { commands } from "./commands";

test("reports artifact removal after its records and snapshots are deleted", async () => {
  const storage = createMemoryStorage();
  const snapshots = createMemoryRepoFiles();
  const files = createMemoryRepoFiles();
  await files.writeText("page.html", "<title>Published page</title>");
  const removed: unknown[] = [];
  const overrides = {
    projectFiles: files,
    artifacts: { mount: () => snapshots },
    resources: {
      removed: async (resource: unknown) => {
        expect(await storage.collection("artifacts").list()).toEqual([]);
        expect(await storage.collection("revisions").list()).toEqual([]);
        expect(await snapshots.list()).toEqual([]);
        removed.push(resource);
      },
    },
  };
  const published = await commands.publish.run(
    ...makeCommandArgs({ storage, params: { file_path: "page.html" }, overrides }),
  );

  await commands.delete.run(...makeCommandArgs({ storage, params: { url: published.url }, overrides }));

  expect(removed).toEqual([{ type: "artifact", id: published.artifactId }]);
});
