import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@pstdio/sdk/client";
import type { StorageRecord } from "@pstdio/sdk/extensions";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { createPackagedSyncPeer } from "./packaged-sync-relay.fixture";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

const waitFor = async (condition: () => Promise<boolean> | boolean) => {
  while (!(await condition())) await Bun.sleep(25);
};
export const registerDocumentSyncSmokeTests = () =>
  test(
    "compiled host uploads encrypted states and blobs and sets aside unreadable updates",
    async () => {
      const root = await mkdtemp(join(tmpdir(), "packaged-document-sync-"));
      const key = join(root, "peer-key.pem");
      const cert = join(root, "peer-cert.pem");
      const certificate = Bun.spawnSync([
        "openssl",
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-keyout",
        key,
        "-out",
        cert,
        "-days",
        "1",
        "-subj",
        "/CN=localhost",
        "-addext",
        "subjectAltName=IP:127.0.0.1,DNS:localhost",
      ]);
      expect(certificate.exitCode).toBe(0);
      const peer = createPackagedSyncPeer({ key: Bun.file(key), cert: Bun.file(cert) });
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
      const host = await startPackagedServe(root, {
        PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify([{ source, installName: "shared-notes" }]),
        NODE_EXTRA_CA_CERTS: cert,
      });
      try {
        const client = createClient({ baseUrl: host.baseUrl, token: host.descriptor.token });
        const project = await client.projects.create(folderProjectInput({ name: "Encrypted notes" }, root));
        const command = async <T>(id: string, params: unknown = {}) => {
          const response = await fetch(
            `${host.baseUrl}/v1/projects/${project.id}/extensions/commands/example.shared-notes.command.${id}/execute`,
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
        const login = await client.account.login(peer.origin);
        const url = new URL(login.url);
        const callback = new URL(url.searchParams.get("callback")!);
        callback.searchParams.set("state", url.searchParams.get("state")!);
        callback.searchParams.set("code", "one-use");
        expect((await fetch(callback)).status).toBe(200);
        const { note } = await command<{ note: StorageRecord }>("read");
        const asset = await command("stage", { operationId: "offline-image", content: "packaged-secret image" });
        await command("commit", {
          group: {
            operationId: "offline-note",
            edits: [{ recordId: note.recordId, replace: `packaged-secret${"x".repeat(1_048_576)}`, asset }],
          },
        });
        const syncState = async () => (await client.account.projectSyncStatus(project.id)).state;
        expect(await syncState()).toBe("local");
        await client.account.syncProject(project.id);
        await waitFor(() => peer.states() > 0);
        await waitFor(async () => (await syncState()) === "synced");
        expect(await client.account.projectSyncStatus(project.id)).toEqual({ state: "synced", offlineReady: true });
        peer.corrupt();
        const quarantine = join(root, "state", "sync-quarantine");
        await waitFor(async () => (await readdir(quarantine).catch(() => [])).some((file) => file.endsWith(".json")));
        await waitFor(async () => (await syncState()) === "needs-attention");
        await command("commit", {
          group: {
            operationId: "healthy-after-corrupt",
            edits: [{ recordId: note.recordId, replace: "healthy after corrupt update" }],
          },
        });
        await waitFor(() => [...peer.documents.values()].some((document) => document.updates.length >= 3));
        const files = await readdir(quarantine);
        const saved = await Bun.file(join(quarantine, files[0]!)).text();
        expect(saved).toContain("invalidciphertext000000");
        expect(saved).not.toContain("packaged-secret");
      } finally {
        await stopProcess(host.child);
        await peer.stop();
        await rm(root, { recursive: true, force: true });
      }
    },
    PACKAGED_TEST_TIMEOUT,
  );
