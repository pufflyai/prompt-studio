import { expect, test } from "bun:test";
import { createMemoryRepoFiles, createMemoryStorage, makeCommandArgs } from "@pstdio/sdk/testing";
import { commands } from "./commands";
import { artifactTarget } from "./contracts";
import { artifactResources } from "./resources";

const fixture = (projectId = "project-one") => {
  const storage = createMemoryStorage();
  const files = createMemoryRepoFiles();
  const snapshots = createMemoryRepoFiles();
  const [ctx] = makeCommandArgs({
    storage,
    params: {},
    overrides: { projectId, projectFiles: files, artifacts: { mount: () => snapshots } },
  });
  const publish = async (title: string, url?: string) => {
    await files.writeText("page.html", `<title>${title}</title>`);
    return commands.publish.run(ctx, { file_path: "page.html", url });
  };
  const query = (text = "", limit = 20) =>
    artifactResources.query(ctx, {
      providerId: "artifacts",
      query: text,
      limit,
      renderer: { rendererId: "artifact-search" },
    });
  return { ctx, publish, query };
};

test("searches current artifact names with one stable result per artifact", async () => {
  const { ctx, publish, query } = fixture();
  const first = await publish("Release draft");
  await publish("Release overview", first.url);
  await publish("Research brief");
  const { items } = await query("  RELEASE  ");
  expect(items).toEqual([
    {
      id: first.artifactId,
      label: "Release overview",
      icon: "file-code",
      target: artifactTarget(ctx.projectId, first.artifactId, "Release overview"),
    },
  ]);
  expect((await query("Release draft")).items).toEqual([]);
  expect((await query("", 1)).items).toHaveLength(1);
  expect((await query("", 0)).items).toEqual([]);
});

test("resource searches reflect renaming and deletion without changing identity", async () => {
  const { ctx, publish, query } = fixture();
  const first = await publish("Original");
  await commands.rename.run(ctx, { url: first.url, name: "Launch plan" });
  await publish("Updated HTML title", first.url);
  expect((await query("Original")).items).toEqual([]);
  expect((await query("launch")).items.map(({ id, label }) => ({ id, label }))).toEqual([
    { id: first.artifactId, label: "Launch plan" },
  ]);
  await commands.delete.run(ctx, { url: first.url });
  expect((await query()).items).toEqual([]);
});

test("resource searches stay within the current project", async () => {
  const first = fixture();
  const other = fixture("project-two");
  await first.publish("Private report");
  expect((await other.query()).items).toEqual([]);
});
