import { expect, test } from "bun:test";
import { createMemoryRepoFiles, createMemoryStorage, makeCommandArgs } from "@pstdio/sdk/testing";
import { resolveResources } from "./artifact-actions";
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

test("publishing returns a usable URL for the host-provided owner", async () => {
  const storage = createMemoryStorage();
  const files = createMemoryRepoFiles();
  const snapshots = createMemoryRepoFiles();
  await files.writeText("page.html", "<title>Current owner</title>");
  const opened: unknown[] = [];
  const overrides = {
    extensionId: "pstdio.artifacts",
    projectFiles: files,
    artifacts: { mount: () => snapshots },
    navigation: {
      open: (target: unknown) => {
        opened.push(target);
      },
    },
  };
  const first = await commands.publish.run(
    ...makeCommandArgs({ storage, params: { file_path: "page.html" }, overrides }),
  );
  expect(first.url).toContain("/extensions/pstdio.artifacts/");
  const updated = await commands.publish.run(
    ...makeCommandArgs({ storage, params: { file_path: "page.html", url: first.url }, overrides }),
  );
  expect(updated.artifactId).toBe(first.artifactId);
  expect(updated.url).toBe(first.url);
  await commands.open.run(...makeCommandArgs({ storage, params: { url: first.url }, overrides }));
  expect(opened).toEqual([updated.target]);
  const resolved = await resolveResources.run(
    ...makeCommandArgs({ storage, params: { resources: [first.resource] }, overrides }),
  );
  expect(resolved).toMatchObject([{ resource: { extensionId: "pstdio.artifacts", id: first.artifactId } }]);
});

// Existing consumers subscribe to this exported raw key independently of package names.
test("publishing notifies historical artifact subscribers once", async () => {
  const files = createMemoryRepoFiles();
  await files.writeText("page.html", "<title>Retained event</title>");
  const received: unknown[] = [];
  const published = await commands.publish.run(
    ...makeCommandArgs({
      storage: createMemoryStorage(),
      params: { file_path: "page.html" },
      overrides: {
        extensionId: "pstdio.artifacts",
        projectFiles: files,
        artifacts: { mount: () => createMemoryRepoFiles() },
        events: {
          emit: async (event, payload) => {
            if (event === "pstdio.pstdio-artifacts.artifacts.changed") received.push(payload);
            return { delivered: received.length };
          },
        },
      },
    }),
  );
  expect(received).toEqual([{ artifactId: published.artifactId }]);
});

test("canonical and historical allocated snapshots resolve the same artifact", async () => {
  const storage = createMemoryStorage();
  const snapshots = createMemoryRepoFiles();
  const projectFiles = createMemoryRepoFiles();
  await projectFiles.writeText("page.html", "<title>Allocated paths</title>");
  const [ctx, input] = makeCommandArgs({
    storage,
    params: { file_path: "page.html" },
    overrides: { extensionId: "pstdio.artifacts", projectFiles, artifacts: { mount: () => snapshots } },
  });
  const published = await commands.publish.run(ctx, input);
  const resolutions = await Promise.all(
    ["pstdio.pstdio-artifacts", "pstdio.artifacts"].map((owner) =>
      commands["resolve-path"].run(ctx, {
        path: `.pstdio/extension-storage/${owner}/sites/${published.revisionId}.html`,
        workspaceId: "workspace",
      }),
    ),
  );
  expect(resolutions[0]).not.toBeNull();
  expect(resolutions[0]).toEqual(resolutions[1]);
});
