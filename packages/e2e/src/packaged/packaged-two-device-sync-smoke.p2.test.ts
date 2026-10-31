import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@pstdio/sdk/client";
import type { ProjectSyncState, StorageRecord } from "@pstdio/sdk/extensions";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createSyncSpace } from "pstdio-sync/encryption";
import { coreOwnerId, projectInfoDocumentId } from "pstdio-sync/records";
import { folderProjectInput } from "../helpers/folder-project";
import { logTestPhase } from "../scripts/log-test-phase";
import { openCloudProjectInPicker, reopenPreparedProjectOffline } from "./packaged-cloud-project-picker";
import { startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";
import { createPackagedSyncPeer, packagedProjectKey } from "./packaged-sync-relay.fixture";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

const waitFor = async (condition: () => Promise<boolean> | boolean) => {
  while (!(await condition())) await Bun.sleep(25);
};

const writeCertificate = (root: string) => {
  const key = join(root, "peer-key.pem");
  const cert = join(root, "peer-cert.pem");
  const subject = ["-subj", "/CN=localhost", "-addext", "subjectAltName=IP:127.0.0.1,DNS:localhost"];
  const options = ["-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", cert, "-days", "1"];
  expect(Bun.spawnSync(["openssl", "req", ...options, ...subject]).exitCode).toBe(0);
  return { key, cert };
};

const writeExtension = async (root: string) => {
  const source = join(root, "source");
  await mkdir(source);
  const build = await Bun.build({
    entrypoints: [join(import.meta.dir, "fixtures/grouped-storage-extension.ts")],
    target: "bun",
  });
  if (!build.success) throw new AggregateError(build.logs, "Could not build storage fixture");
  await Bun.write(join(source, "extension.js"), build.outputs[0]!);
  await Bun.write(
    join(source, "package.json"),
    JSON.stringify({
      name: "shared-notes",
      publisher: "example",
      version: "1.0.0",
      type: "module",
      main: "extension.js",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  return source;
};

const startDevice = async (root: string, env: Record<string, string>) => {
  await mkdir(root, { recursive: true });
  const host = await startPackagedServe(root, env);
  const client = createClient({ baseUrl: host.baseUrl, token: host.descriptor.token });
  const command = async <T>(projectId: string, id: string, params: unknown = {}) => {
    const response = await fetch(
      `${host.baseUrl}/v1/projects/${projectId}/extensions/commands/example.shared-notes.command.${id}/execute`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${host.descriptor.token}`, "content-type": "application/json" },
        body: JSON.stringify({ params }),
      },
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { outcome: { ok: boolean; value: T } };
    expect(body.outcome.ok).toBe(true);
    return body.outcome.value;
  };
  const state = async (projectId: string) => (await client.account.projectSyncStatus(projectId)).state;
  const reach = (projectId: string, expected: ProjectSyncState) =>
    waitFor(async () => (await state(projectId)) === expected);
  return { host, client, command, state, reach };
};

const signIn = async (device: Awaited<ReturnType<typeof startDevice>>, origin: string) => {
  const login = await device.client.account.login(origin);
  const url = new URL(login.url);
  const callback = new URL(url.searchParams.get("callback")!);
  callback.searchParams.set("state", url.searchParams.get("state")!);
  callback.searchParams.set("code", "one-use");
  expect((await fetch(callback)).status).toBe(200);
};

const git = (cwd: string, ...args: string[]) =>
  expect(Bun.spawnSync(["git", ...args], { cwd, stdout: "ignore", stderr: "ignore" }).exitCode).toBe(0);

// A repository with one commit, served from a local path like any git remote.
const writeRepository = async (path: string) => {
  await mkdir(path);
  git(path, "init", "-q");
  await Bun.write(join(path, "README.md"), "Shared notes");
  git(path, "add", ".");
  git(path, "-c", "user.name=Test", "-c", "user.email=test@example.test", "commit", "-qm", "first");
};

const write = (device: Awaited<ReturnType<typeof startDevice>>, projectId: string, field: string, value: string) =>
  device.command<Record<string, StorageRecord>>(projectId, "read").then((records) =>
    device.command(projectId, "commit", {
      group: { operationId: `${field}-${value}`, edits: [{ recordId: records[field]!.recordId, replace: value }] },
    }),
  );

setupPackagedSmokeTests();
test(
  "a new device opens its cloud project from the picker, prepares its folder, and restores shared files",
  async () => {
    const startedAt = Date.now();
    const phase = (name: string) => logTestPhase(`Cloud project opening: ${name} (+${Date.now() - startedAt}ms)`);
    const root = await mkdtemp(join(tmpdir(), "packaged-two-device-sync-"));
    const tls = writeCertificate(root);
    const peer = createPackagedSyncPeer({ key: Bun.file(tls.key), cert: Bun.file(tls.cert) });
    const source = await writeExtension(root);
    const env = {
      PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify([{ source, installName: "shared-notes" }]),
      NODE_EXTRA_CA_CERTS: tls.cert,
    };
    const first = await startDevice(join(root, "first"), env);
    let second = await startDevice(join(root, "second"), env);
    phase("devices ready");
    let picker: Awaited<ReturnType<typeof openCloudProjectInPicker>> | undefined;
    try {
      const remote = join(root, "origin");
      await writeRepository(remote);
      const checkout = join(root, "first-checkout");
      git(root, "clone", "-q", remote, checkout);
      const project = await first.client.projects.create(folderProjectInput({ name: "Shared notes" }, checkout));
      await write(first, project.id, "note", "written on the first device");
      await first.command(project.id, "write-file", { path: "note.md", content: "# Shared note" });
      await first.command(project.id, "write-file", { path: "artifact.html", content: "<h1>Shared artifact</h1>" });
      phase("source files saved");
      await signIn(first, peer.origin);
      await first.client.account.syncProject(project.id);
      await first.reach(project.id, "synced");
      phase("source project synced");

      // A new device reads the project's info before anything else. Let it read that one document and none
      // of the project's data yet. The first device may still be reading, so name the document by its relay ID,
      // which every device derives from the project key the peer hands out.
      const space = await createSyncSpace({ projectId: project.id, spaceOwner: null, keys: [packagedProjectKey] });
      const info = await space.documentId(JSON.stringify([coreOwnerId, projectInfoDocumentId]));
      peer.failReads((documentId) => documentId !== info);
      await signIn(second, peer.origin);
      await waitFor(async () => (await second.client.projects.query()).items.some((item) => item.id === project.id));
      expect((await second.client.projects.get(project.id)).name).toBe("Shared notes");
      await waitFor(async () => (await second.client.projects.folder(project.id)).gitRemote === remote);
      expect((await second.client.projects.folder(project.id)).path).toBeNull();
      await waitFor(() => peer.failedReads() > 0);
      await second.reach(project.id, "first-download-incomplete");
      phase("new device waiting for download");
      const prematureOpen = await fetch(`${second.host.baseUrl}/v1/projects/${project.id}/open`, {
        method: "POST",
        headers: { authorization: `Bearer ${second.host.descriptor.token}` },
      });
      expect(prematureOpen.status).toBe(400);
      expect((await second.client.projects.folder(project.id)).path).toBeNull();
      // Keep two choices in the picker so opening the cloud project is an explicit user action.
      const local = join(root, "second-local");
      await mkdir(local);
      await second.client.projects.create(folderProjectInput({ name: "Local scratchpad" }, local));
      phase("local picker choice created");
      picker = await openCloudProjectInPicker({
        baseUrl: second.host.baseUrl,
        token: second.host.descriptor.token,
        projectId: project.id,
        name: project.name,
      });
      phase("project selected in browser");

      // Losing the connection never turns an incomplete download into a ready one.
      await peer.stop();
      await first.reach(project.id, "offline");
      expect(await first.client.account.projectSyncStatus(project.id)).toEqual({
        state: "offline",
        offlineReady: true,
      });
      expect(await second.client.account.projectSyncStatus(project.id)).toEqual({
        state: "first-download-incomplete",
        offlineReady: false,
      });

      peer.failReads(false);
      peer.restart();
      await picker.retry();
      phase("retry requested");
      await first.reach(project.id, "synced");
      await second.reach(project.id, "synced");
      await picker.ready();
      phase("project folder prepared");
      expect((await second.command<Record<string, StorageRecord>>(project.id, "read")).note?.value).toBe(
        "written on the first device",
      );

      const folderAfterSelection = await second.client.projects.folder(project.id);
      expect(folderAfterSelection.path).toBeTruthy();
      const files = join(folderAfterSelection.path!, ".pstdio/extension-storage/example.shared-notes/documents");
      expect(await Bun.file(join(files, "note.md")).text()).toBe("# Shared note");
      expect(await Bun.file(join(files, "artifact.html")).text()).toBe("<h1>Shared artifact</h1>");
      await second.command(project.id, "write-file", { path: "new-note.md", content: "Written on the new machine" });
      await waitFor(async () => {
        try {
          return (
            (await first.command<string>(project.id, "read-file", { path: "new-note.md" })) ===
            "Written on the new machine"
          );
        } catch {
          return false;
        }
      });
      expect((await second.client.projects.open(project.id)).root_path).toBe(folderAfterSelection.path);
      await second.reach(project.id, "synced");

      // Making the project local is account-wide. The second device learns it on its next account refresh,
      // which a project change starts at once.
      await first.client.account.stopProjectSync(project.id);
      await second.client.projects.update(project.id, { name: "Shared notes (local)" });
      await first.reach(project.id, "local");
      await second.reach(project.id, "local");
      await write(first, project.id, "note", "edited on the first device while local");
      await write(second, project.id, "caption", "edited on the second device while local");

      await first.client.account.syncProject(project.id);
      await second.client.projects.update(project.id, { name: "Shared notes" });
      await first.reach(project.id, "synced");
      await second.reach(project.id, "synced");
      const merged = async (device: typeof first) => {
        const records = await device.command<Record<string, StorageRecord>>(project.id, "read");
        return [records.note?.value, records.caption?.value];
      };
      const expected = ["edited on the first device while local", "edited on the second device while local"];
      await waitFor(async () => Bun.deepEquals(await merged(first), expected));
      await waitFor(async () => Bun.deepEquals(await merged(second), expected));

      const history = await first.command<{ events: ProjectSyncState[]; current: unknown }>(project.id, "sync-history");
      expect(history.current).toEqual({ state: "synced", offlineReady: true });
      expect(history.events).toEqual(expect.arrayContaining(["local", "offline", "synced"]));
      // Reconnecting after the first download catches up; it never reports the first download again.
      const firstSynced = history.events.indexOf("synced");
      const madeLocal = history.events.indexOf("local", firstSynced);
      expect(history.events.slice(firstSynced, madeLocal)).toContain("offline");
      expect(history.events.slice(firstSynced, madeLocal)).not.toContain("first-download-incomplete");
      await picker.close();
      picker = undefined;
      await peer.stop();
      await stopProcess(second.host.child);
      second = await startDevice(join(root, "second"), env);
      expect((await second.client.account.projectSyncStatus(project.id)).offlineReady).toBe(false);
      await reopenPreparedProjectOffline({
        baseUrl: second.host.baseUrl,
        token: second.host.descriptor.token,
        projectId: project.id,
      });
      expect((await second.client.projects.folder(project.id)).path).toBe(folderAfterSelection.path);
      expect(await second.command<string>(project.id, "read-file", { path: "new-note.md" })).toBe(
        "Written on the new machine",
      );
      phase("prepared project reopened offline after restart");
    } finally {
      await picker?.close();
      await stopProcess(first.host.child);
      await stopProcess(second.host.child);
      await peer.stop();
      await rm(root, { recursive: true, force: true });
    }
  },
  PACKAGED_TEST_TIMEOUT,
);
