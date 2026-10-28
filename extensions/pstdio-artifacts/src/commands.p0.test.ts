import { expect, test } from "bun:test";
import { createMemoryRepoFiles, createMemoryStorage, makeCommandArgs } from "@pstdio/sdk/testing";
import { commands } from "./commands";

test("publishing allocates artifact and revision identities through core", async () => {
  const storage = createMemoryStorage();
  const allocate = storage.ids.create;
  const allocated: string[] = [];
  storage.ids.create = () => {
    const id = allocate();
    allocated.push(id);
    return id;
  };
  const projectFiles = createMemoryRepoFiles();
  const snapshots = createMemoryRepoFiles();
  await projectFiles.writeText("page.html", "<title>Core identity</title>");
  const published = await commands.publish.run(
    ...makeCommandArgs({
      storage,
      params: { file_path: "page.html" },
      overrides: { projectFiles, artifacts: { mount: () => snapshots } },
    }),
  );
  expect(allocated).toEqual([published.revisionId, published.artifactId]);
});

test("a selected remote workspace cannot publish a file from the local project folder", async () => {
  const storage = createMemoryStorage();
  const snapshots = createMemoryRepoFiles();
  const projectFiles = createMemoryRepoFiles();
  await projectFiles.writeText("page.html", "<title>Local project content</title>");

  await expect(
    commands.publish.run(
      ...makeCommandArgs({
        storage,
        params: { file_path: "page.html" },
        overrides: {
          workspaceId: "remote-workspace",
          projectFiles,
          artifacts: { mount: () => snapshots },
        },
      }),
    ),
  ).rejects.toThrow("selected workspace");

  expect(await storage.collection("artifacts").list()).toEqual([]);
  expect(await storage.collection("revisions").list()).toEqual([]);
  expect(await snapshots.list()).toEqual([]);
});

test("publishing from a selected workspace reads its working files", async () => {
  const storage = createMemoryStorage();
  const snapshots = createMemoryRepoFiles();
  const projectFiles = createMemoryRepoFiles();
  const workspaceFiles = createMemoryRepoFiles();
  await projectFiles.writeText("page.html", "<title>Project folder</title>");
  await workspaceFiles.writeText("page.html", "<title>Working folder</title>");
  const published = await commands.publish.run(
    ...makeCommandArgs({
      storage,
      params: { file_path: "page.html" },
      overrides: {
        workspaceId: "local-workspace",
        projectFiles,
        workspaceFiles: { ...workspaceFiles, syncDir: async () => undefined },
        artifacts: { mount: () => snapshots },
      },
    }),
  );
  expect(published.title).toBe("Working folder");
  expect(published.source).toEqual({ path: "page.html", workspaceId: "local-workspace" });
});

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
