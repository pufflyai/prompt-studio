import { expect, test } from "bun:test";
import { createMemoryRepoFiles, createMemoryStorage, makeCommandArgs } from "@pstdio/sdk/testing";
import { deleteResource, renameResource, resolvePath, resolveResource } from "./artifact-actions";
import { commands } from "./commands";
import { artifact as artifactKind } from "./resource-kinds";

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
  return { ctx, artifact, files, snapshots };
};

test("renames the selected artifact through its stable resource identity", async () => {
  const { ctx, artifact } = await fixture();
  const result = await renameResource.run(ctx, { artifactId: artifact.artifactId, name: "Launch plan" });
  expect(result.artifactId).toBe(artifact.artifactId);
  expect(result.url).toBe(artifact.url);
  expect((await commands.list.run(ctx, {}))[0].title).toBe("Launch plan");
  expect(await resolveResource.run(ctx, { artifactId: artifact.artifactId })).toMatchObject({
    id: artifact.artifactId,
    label: "Launch plan",
    type: "artifact",
    projectId: ctx.projectId,
  });
});

test("deletes only the selected artifact and its saved revisions", async () => {
  const { ctx, artifact, snapshots } = await fixture();
  await deleteResource.run(ctx, { artifactId: artifact.artifactId });
  expect(await commands.list.run(ctx, {})).toEqual([]);
  expect(await snapshots.list()).toEqual([]);
});

test("resolves an unknown artifact as missing", async () => {
  const { ctx } = await fixture();

  expect(await resolveResource.run(ctx, { artifactId: "missing" })).toBeNull();
});

test("resolves a deleted artifact as missing", async () => {
  const { ctx, artifact } = await fixture();
  await deleteResource.run(ctx, { artifactId: artifact.artifactId });

  expect(await resolveResource.run(ctx, { artifactId: artifact.artifactId })).toBeNull();
});

test("snapshot paths open the artifact that owns the revision", async () => {
  const { ctx, artifact, files } = await fixture();
  await files.writeText("page.html", "<title>Updated report</title>");
  await commands.publish.run(ctx, { file_path: "page.html", url: artifact.url });
  const [claim] = artifactKind.paths ?? [];
  const resolve = (path: string) => resolvePath.run(ctx, { path: `${claim.prefix}${path}`, workspaceId: "workspace" });

  expect(claim.prefix).toBe(".pstdio/extension-storage/pstdio.pstdio-artifacts/sites/");
  expect(resolvePath.id).toBe(claim.resolve.id);
  expect(await resolve(`${artifact.revisionId}.html`)).toMatchObject({
    resource: { type: "artifact", id: artifact.artifactId, label: "Updated report", projectId: ctx.projectId },
    target: {
      kind: "compound",
      targets: [{ kind: "page" }, { kind: "panel", resource: { type: "artifact", id: artifact.artifactId } }],
    },
  });
  expect(await resolve("missing.html")).toBeNull();
  expect(await resolve(`${artifact.revisionId}.txt`)).toBeNull();
  await deleteResource.run(ctx, { artifactId: artifact.artifactId });
  expect(await resolve(`${artifact.revisionId}.html`)).toBeNull();
});
