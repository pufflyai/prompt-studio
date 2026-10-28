import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@pstdio/sdk/client";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";
import { createPackagedSyncPeer } from "./packaged-sync-relay.fixture";
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

// The data migration counts its runs in shared data, so every device sees where it ran.
const writeExtension = async (root: string) => {
  const source = join(root, "source");
  await mkdir(source);
  await Bun.write(
    join(source, "package.json"),
    JSON.stringify({
      name: "unrelated",
      publisher: "example",
      version: "1.0.0",
      main: "extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  await Bun.write(
    join(source, "extension.ts"),
    `export default { resourceKinds: [{ id: "item", ref: { kind: "resource-kind", id: "item" }, prefix: "NI" }], commands: [
      { id: "allocate", ref: { kind: "command", id: "allocate" }, title: "Allocate", mutating: true,
        run(ctx) { return ctx.resources.allocate({ kind: "item" }); } },
      { id: "identity", ref: { kind: "command", id: "identity" }, title: "Identity", params: { id: { type: "string", required: true } },
        run(ctx, params) { return ctx.resources.identity({ kind: "item", id: params.id }); } },
      { id: "find", ref: { kind: "command", id: "find" }, title: "Find", params: { shorthand: { type: "string", required: true } },
        run(ctx, params) { return ctx.resources.findByShorthand({ kind: "item", shorthand: params.shorthand }); } },
      { id: "write", ref: { kind: "command", id: "write" }, title: "Write", mutating: true,
        async run(ctx) { await ctx.storage.set("note", "written by the local override"); return true; } },
      { id: "read", ref: { kind: "command", id: "read" }, title: "Read",
        async run(ctx) { return { note: (await ctx.storage.get("note")) ?? null, migrations: (await ctx.storage.get("migrations")) ?? 0 }; } },
      { id: "migrate", ref: { kind: "command", id: "migrate" }, title: "Migrate", mutating: true,
        async run(ctx) { await ctx.storage.migrate(1, async () => {
          await ctx.storage.set("migrations", ((await ctx.storage.get("migrations")) ?? 0) + 1);
        }); return true; } },
    ] };`,
  );
  return source;
};

type Extension = { id: string; extensionId: string; version?: string | null; enabled: boolean; sourcePath: string };

const startDevice = async (root: string, env: Record<string, string>) => {
  await mkdir(root);
  const host = await startPackagedServe(root, env);
  const client = createClient({ baseUrl: host.baseUrl, token: host.descriptor.token });
  const headers = { authorization: `Bearer ${host.descriptor.token}`, "content-type": "application/json" };
  const command = async <T>(projectId: string, id: string, params: Record<string, string> = {}) => {
    const response = await fetch(
      `${host.baseUrl}/v1/projects/${projectId}/extensions/commands/example.unrelated.command.${id}/execute`,
      { method: "POST", headers, body: JSON.stringify({ params }) },
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { outcome: { ok: boolean; value: T } };
    expect(body.outcome.ok).toBe(true);
    return body.outcome.value;
  };
  const publications = async (projectId: string) =>
    (await (await fetch(`${host.baseUrl}/v1/projects/${projectId}/extension-publications`, { headers })).json()) as {
      recordId: string;
      revision: string;
      value: { revision: string; version: string; enabled: boolean } | null;
    }[];
  const publish = async (projectId: string, instanceId: string) => {
    const [record] = await publications(projectId);
    const response = await fetch(`${host.baseUrl}/v1/projects/${projectId}/extension-publications`, {
      method: "POST",
      headers,
      body: JSON.stringify({ kind: "publish", instanceId, expectedRevision: record!.revision }),
    });
    expect(response.status).toBe(200);
  };
  const extension = async (projectId: string) =>
    ((await client.extensions.listProject(projectId)).extensions as Extension[]).find(
      (candidate) => candidate.extensionId === "example.unrelated",
    );
  return { host, client, command, publications, publish, extension };
};

const signIn = async (device: Awaited<ReturnType<typeof startDevice>>, origin: string) => {
  const login = await device.client.account.login(origin);
  const url = new URL(login.url);
  const callback = new URL(url.searchParams.get("callback")!);
  callback.searchParams.set("state", url.searchParams.get("state")!);
  callback.searchParams.set("code", "one-use");
  expect((await fetch(callback)).status).toBe(200);
};

setupPackagedSmokeTests();
test(
  "three compiled hosts run the published extension version; a local override keeps its code and skips migrations",
  async () => {
    const root = await mkdtemp(join(tmpdir(), "packaged-cloud-extension-set-"));
    const tls = writeCertificate(root);
    const peer = createPackagedSyncPeer({ key: Bun.file(tls.key), cert: Bun.file(tls.cert) });
    const source = await writeExtension(root);
    const env = { NODE_EXTRA_CA_CERTS: tls.cert };
    const started = await Promise.allSettled(["a", "b", "c"].map((name) => startDevice(join(root, name), env)));
    const devices = started.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
    const [a, b, c] = devices as [(typeof devices)[0], (typeof devices)[0], (typeof devices)[0]];
    try {
      expect(devices).toHaveLength(3);
      const project = await a.client.projects.create(folderProjectInput({ name: "Cloud extensions" }));
      const installed = await a.client.extensions.enableInstalled(project.id, "unrelated", {
        displayName: "Unrelated",
        extensionId: "example.unrelated",
        name: "unrelated",
        manifest: { name: "unrelated" },
        sourceKind: "local_path",
        sourcePath: source,
        sourceHash: null,
        sourceRef: null,
        version: "1.0.0",
      });
      await a.publish(project.id, installed.instanceId);
      const [published] = await a.publications(project.id);
      expect(published!.value).toMatchObject({ version: "1.0.0", enabled: true });
      await signIn(a, peer.origin);
      await a.client.account.syncProject(project.id);

      // B and C start without the extension. The synced set installs the published package.
      for (const device of [b, c]) {
        await signIn(device, peer.origin);
        const { environmentId } = await device.client.runtime.environment();
        await device.client.projects.bindEnvironment(project.id, {
          environmentId,
          name: "Cloud extensions",
          initial_workspace: folderProjectInput({}).initial_workspace,
        });
      }
      for (const device of [b, c]) {
        await waitFor(async () => (await device.extension(project.id))?.enabled === true);
        const running = (await device.extension(project.id))!;
        expect(running.version).toBe("1.0.0");
        expect(running.sourcePath).not.toBe(source);
        expect((await device.publications(project.id))[0]!.value?.revision).toBe(published!.value!.revision);
      }

      // A keeps its own copy: it writes shared data, but its data migration does not run.
      expect((await a.extension(project.id))!.sourcePath).toBe(source);
      await a.command(project.id, "migrate");
      await a.command(project.id, "write");
      for (const device of [b, c])
        await waitFor(
          async () =>
            (await device.command<{ note: string | null }>(project.id, "read")).note ===
            "written by the local override",
        );
      expect((await a.command<{ migrations: number }>(project.id, "read")).migrations).toBe(0);

      // The synced version on B runs the migration, and its result reaches A and C.
      await b.command(project.id, "migrate");
      for (const device of [a, c])
        await waitFor(async () => (await device.command<{ migrations: number }>(project.id, "read")).migrations === 1);

      type Identity = { id: string; shorthand: string; aliases: string[] };
      const seed = await a.command<Identity>(project.id, "allocate");
      for (const device of [b, c])
        await waitFor(async () => !!(await device.command<Identity | null>(project.id, "identity", { id: seed.id })));
      await peer.stop();
      const allocated = await Promise.all([a, b].map((device) => device.command<Identity>(project.id, "allocate")));
      expect(allocated.map((identity) => identity.shorthand)).toEqual(["NI-2", "NI-2"]);
      peer.restart();
      const [winner, loser] = allocated.sort((x, y) => (x.id < y.id ? -1 : 1));
      for (const device of [a, b, c]) {
        await waitFor(
          async () =>
            (await device.command<Identity | null>(project.id, "identity", { id: loser!.id }))?.shorthand === "NI-3",
        );
        expect(await device.command(project.id, "identity", { id: winner!.id })).toMatchObject({
          shorthand: "NI-2",
          aliases: [],
        });
        expect(await device.command(project.id, "identity", { id: loser!.id })).toMatchObject({
          shorthand: "NI-3",
          aliases: ["NI-2"],
        });
        expect(
          (await device.command<Identity[]>(project.id, "find", { shorthand: "NI-2" })).map((identity) => identity.id),
        ).toEqual([winner!.id, loser!.id]);
      }
      const afterRepair = await a.command<Identity>(project.id, "allocate");
      expect(afterRepair.shorthand).toBe("NI-4");
      for (const device of [b, c])
        await waitFor(
          async () => !!(await device.command<Identity | null>(project.id, "identity", { id: afterRepair.id })),
        );
      expect((await b.command<Identity>(project.id, "allocate")).shorthand).toBe("NI-5");
    } finally {
      await Promise.all(devices.map((device) => stopProcess(device.host.child)));
      await peer.stop();
      await rm(root, { recursive: true, force: true });
    }
  },
  process.platform === "win32" ? 60_000 : PACKAGED_TEST_TIMEOUT,
);
