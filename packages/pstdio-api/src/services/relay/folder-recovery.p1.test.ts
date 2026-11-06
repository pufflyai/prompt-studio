import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSyncSpace } from "pstdio-sync/encryption";
import { documentPeer } from "../../features/extensions/publication/document-peer.fixture";
import { createTestApp } from "../../test-utils/create-test-app";
import { createRecoveryCatalog } from "../project-recovery/catalog";
import { createRecoveryChunkStore } from "../project-recovery/chunks";
import { openRecoveryJournal } from "../project-recovery/journal";
import { createRecoveryPages } from "../project-recovery/pages";
import { downloadRecoveryCapture } from "../project-recovery/transfer";
import { startFolderRecovery } from "./folder-recovery";

const until = async (condition: () => boolean | Promise<boolean>) => {
  const end = Date.now() + 10_000;
  while (!(await condition()) && Date.now() < end) await Bun.sleep(10);
  expect(await condition()).toBe(true);
};

test("each device captures its folder automatically and downloads every completed source without the source online", async () => {
  const folderRoot = await mkdtemp(join(tmpdir(), "folder-recovery-owner-"));
  const source = await createTestApp();
  const destination = await createTestApp();
  const peer = documentPeer();
  const controller = new AbortController();
  const owners: ReturnType<typeof startFolderRecovery>[] = [];
  try {
    const folder = join(folderRoot, "project");
    await mkdir(join(folder, "node_modules/package"), { recursive: true });
    await writeFile(join(folder, ".env"), "PRIVATE_OWNER_SECRET=retained");
    await writeFile(join(folder, "node_modules/package/index.js"), "excluded");
    const project = await source.deps.projectService.create({ name: "Recovered folder" });
    await source.deps.workspaceService.ensureDefault({ project_id: project.id, root_path: folder, name: "Folder" });
    await destination.deps.projectService.create({ id: project.id, name: project.name });
    const config = {
      accountId: "alice",
      workbenchId: project.id,
      managerOrigin: peer.origin,
      relayOrigin: peer.origin,
      renewalGrant: "grant",
    };
    const start = (app: typeof source, environmentId: string) => {
      const owner = startFolderRecovery({
        deps: app.deps,
        config: { ...config, environmentId },
        signal: controller.signal,
        access: async () => ({ token: environmentId, expiresAt: new Date(Date.now() + 60_000).toISOString() }),
        schedule: { quietMs: 20, gapMs: 0 },
      });
      owners.push(owner);
      return owner;
    };
    const sourceOwner = start(source, "laptop");
    start(destination, "desktop");
    const space = await createSyncSpace({
      projectId: project.id,
      spaceOwner: "alice",
      keys: [{ generation: 1, secret: "B".repeat(43) }],
    });
    const catalog = createRecoveryCatalog({
      projectId: project.id,
      accountId: "alice",
      managerOrigin: peer.origin,
      deviceId: "desktop",
      documents: destination.deps.extensionStorageService.documents,
    });
    const offline = {
      put: async () => {
        throw new Error("Offline");
      },
      get: async () => {
        throw new Error("Offline");
      },
    };
    const local = await createRecoveryChunkStore({
      root: join(destination.deps.projectRecovery.root, "chunks"),
      space,
    });
    const downloaded = async () => {
      const [entry] = await catalog.list();
      if (!entry) return null;
      try {
        return {
          entry,
          manifest: await downloadRecoveryCapture({ chunks: local, candidate: entry.root, transport: offline }),
        };
      } catch {
        return null;
      }
    };
    await until(async () => (await downloaded()) !== null);
    const first = (await downloaded())!;
    expect(first.entry.deviceId).toBe("laptop");
    expect(first.manifest.capture.policy).toBe("node_modules/\n");
    expect(await readFile(join(folder, ".pstignore"), "utf8")).toBe("node_modules/\n");
    const paths: string[] = [];
    for await (const entry of createRecoveryPages(local).entries(first.manifest.capture.inventory))
      paths.push(entry.path);
    expect(paths).toEqual(expect.arrayContaining([".env", ".pstignore"]));
    expect(paths.some((path) => path.startsWith("node_modules/"))).toBe(false);
    for (const blob of peer.blobs.values())
      for (const part of blob.parts.values()) expect(Buffer.from(part).includes("PRIVATE_OWNER_SECRET")).toBe(false);

    await writeFile(join(folder, "created-later"), "saved without a commit");
    await until(async () => (await downloaded())?.manifest.capture.files === first.manifest.capture.files + 1);

    // Deleting the policy is deliberate: a restarted owner never seeds it again.
    sourceOwner.close();
    await sourceOwner.done;
    await unlink(join(folder, ".pstignore"));
    start(source, "laptop");
    await until(async () => (await downloaded())?.manifest.capture.policy === null);
    await expect(readFile(join(folder, ".pstignore"))).rejects.toThrow();
    expect((await downloaded())!.manifest.capture.files).toBe(first.manifest.capture.files + 1);
  } finally {
    controller.abort();
    await Promise.all(owners.map((owner) => owner.done));
    peer.close();
    await source.close();
    await destination.close();
    await rm(folderRoot, { recursive: true, force: true });
  }
});

test("a source this device cannot publish still downloads every other completed source", async () => {
  const folderRoot = await mkdtemp(join(tmpdir(), "folder-recovery-isolated-"));
  const source = await createTestApp();
  const destination = await createTestApp();
  const peer = documentPeer();
  const controller = new AbortController();
  const owners: ReturnType<typeof startFolderRecovery>[] = [];
  const foreign = Bun.spawn(["sleep", "60"]);
  try {
    const project = await source.deps.projectService.create({ name: "Blocked publisher" });
    await destination.deps.projectService.create({ id: project.id, name: project.name });
    for (const [app, name] of [
      [source, "laptop"],
      [destination, "desktop"],
    ] as const) {
      await mkdir(join(folderRoot, name));
      await writeFile(join(folderRoot, name, "notes"), `${name} notes`);
      await app.deps.workspaceService.ensureDefault({
        project_id: project.id,
        root_path: join(folderRoot, name),
        name: "Folder",
      });
    }
    // Another live process owns the destination's own folder and it has a saved candidate.
    const workspace = (await destination.deps.workspaceService.getDefault(project.id))!;
    const folder = join(folderRoot, "desktop");
    const sourceKey = [
      project.id,
      "alice",
      "desktop",
      `${workspace.id}:${createHash("sha256").update(folder).digest("hex").slice(0, 16)}`,
    ];
    const journal = await openRecoveryJournal({ root: destination.deps.projectRecovery.root, source: sourceKey });
    await journal.update({
      enrolled: true,
      candidate: {
        blobId: "AAAAAAAAAAAAAAAAAAAAAA",
        byteLength: 10,
        sha256: "a".repeat(64),
        encryptedByteLength: 38,
        encryptedSha256: "b".repeat(64),
      },
    });
    const lockName = `${createHash("sha256").update(JSON.stringify(sourceKey)).digest("hex").slice(0, 32)}.lock`;
    await writeFile(
      join(destination.deps.projectRecovery.root, "sources", lockName),
      JSON.stringify({ pid: foreign.pid, token: "other-process" }),
    );
    const config = {
      accountId: "alice",
      workbenchId: project.id,
      managerOrigin: peer.origin,
      relayOrigin: peer.origin,
      renewalGrant: "grant",
    };
    for (const [app, environmentId] of [
      [source, "laptop"],
      [destination, "desktop"],
    ] as const)
      owners.push(
        startFolderRecovery({
          deps: app.deps,
          config: { ...config, environmentId },
          signal: controller.signal,
          access: async () => ({ token: environmentId, expiresAt: new Date(Date.now() + 60_000).toISOString() }),
          schedule: { quietMs: 20, gapMs: 0 },
        }),
      );
    const catalog = createRecoveryCatalog({
      projectId: project.id,
      accountId: "alice",
      managerOrigin: peer.origin,
      deviceId: "desktop",
      documents: destination.deps.extensionStorageService.documents,
    });
    await until(async () => (await catalog.list()).some((entry) => entry.deviceId === "laptop"));
    await until(async () => (await owners[1]!.status()).needsAttention);
  } finally {
    foreign.kill();
    controller.abort();
    await Promise.all(owners.map((owner) => owner.done));
    peer.close();
    await source.close();
    await destination.close();
    await rm(folderRoot, { recursive: true, force: true });
  }
});
