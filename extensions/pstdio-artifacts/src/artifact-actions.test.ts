import { expect, test } from "bun:test";
import { createMemoryRepoFiles, createMemoryStorage, makeCommandArgs } from "@pstdio/sdk/testing";
import { deleteResource, renameResource } from "./artifact-actions";
import { commands } from "./commands";

const fixture = async () => {
  const storage = createMemoryStorage();
  const files = createMemoryRepoFiles();
  const snapshots = createMemoryRepoFiles();
  await files.writeText("page.html", "<title>Original report</title>");
  const [ctx] = makeCommandArgs({
    storage,
    params: {},
    overrides: {
      projectFiles: files,
      artifacts: { mount: () => snapshots },
    },
  });
  const artifact = await commands.publish.run(ctx, { file_path: "page.html" });
  return { ctx, artifact, snapshots };
};

test("renames the selected artifact through its stable resource identity", async () => {
  const { ctx, artifact } = await fixture();
  const result = await renameResource.run(ctx, { artifactId: artifact.artifactId, name: "Launch plan" });
  expect(result.artifactId).toBe(artifact.artifactId);
  expect(result.url).toBe(artifact.url);
  expect((await commands.list.run(ctx, {}))[0].title).toBe("Launch plan");
});

test("deletes only the selected artifact and its saved revisions", async () => {
  const { ctx, artifact, snapshots } = await fixture();
  await deleteResource.run(ctx, { artifactId: artifact.artifactId });
  expect(await commands.list.run(ctx, {})).toEqual([]);
  expect(await snapshots.list()).toEqual([]);
});
