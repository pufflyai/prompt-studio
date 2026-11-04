import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@pstdio/sdk/client";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createDeviceCommandPolling } from "./packaged-device-command-polling";
import { createDeviceCommandPeer } from "./packaged-device-commands.fixture";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

setupPackagedSmokeTests();

test(
  "compiled devices run remote sessions, send large follow-ups and files, and interrupt only the target turn",
  async () => {
    const polling = createDeviceCommandPolling(Date.now() + PACKAGED_TEST_TIMEOUT - 5_000);
    const { waitFor } = polling;
    const root = await mkdtemp(join(tmpdir(), "packaged-device-commands-"));
    const key = join(root, "key.pem");
    const cert = join(root, "cert.pem");
    expect(
      Bun.spawnSync([
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
      ]).exitCode,
    ).toBe(0);
    const peer = createDeviceCommandPeer({ key: Bun.file(key), cert: Bun.file(cert) });
    const source = join(root, "harness");
    await mkdir(source);
    await Bun.write(
      join(source, "package.json"),
      JSON.stringify({
        name: "device-command-fixture",
        publisher: "test",
        version: "1.0.0",
        main: "extension.ts",
        engines: { pstdio: `^${EXTENSION_API_VERSION}` },
      }),
    );
    await Bun.write(
      join(source, "extension.ts"),
      `const running = new Map();
const start = (_ctx, input) => {
  input.events.push({ op: "add", path: "/messages/0", value: { id: "first", role: "assistant", parts: [{ type: "text", text: "Remote fixture is running" }] } });
  let resolve; const done = new Promise(r => { resolve = r; });
  return { agentSessionId: "native-" + crypto.randomUUID(), done, stop() { resolve({ status: "cancelled" }); } };
};
export default { harnesses: [{ id: "worker", ref: { kind: "harness", id: "worker" }, label: "Worker", capabilities: () => [], start, resume: start, getMessages: () => [], recoverMessages(_ctx, input) { return { kind: "recovered", messages: input.knownMessages }; } }] };`,
    );
    const env = {
      NODE_EXTRA_CA_CERTS: cert,
      PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify([{ source, installName: "device-command-fixture" }]),
    };
    await mkdir(join(root, "a"));
    await mkdir(join(root, "b"));
    const a = await startPackagedServe(join(root, "a"), env);
    let b: Awaited<ReturnType<typeof startPackagedServe>> | undefined;
    const projectId = crypto.randomUUID();
    try {
      b = await startPackagedServe(join(root, "b"), env);
      const connect = async (host: typeof a, folder: string) => {
        process.stderr.write(`Device command fixture: bind ${folder}\n`);
        await mkdir(folder);
        const client = createClient({ baseUrl: host.baseUrl, token: host.descriptor.token, fetch: polling.fetch });
        const identity = await client.runtime.environment();
        expect(
          (
            await fetch(`${host.baseUrl}/v1/projects/${projectId}/environment-binding`, {
              method: "PUT",
              headers: { ...runtimeAuthorization(host.descriptor), "content-type": "application/json" },
              body: JSON.stringify({
                ...identity,
                name: "Remote fixture",
                initial_workspace: { provider_id: "pstdio.root", params: { path: folder } },
              }),
            })
          ).status,
        ).toBe(201);
        await client.extensions.enableInstalled(projectId, "device-command-fixture", {
          displayName: "Fixture",
          extensionId: "test.device-command-fixture",
          name: "device-command-fixture",
          manifest: { name: "device-command-fixture" },
          sourceKind: "local_path",
          sourcePath: source,
          sourceHash: null,
          sourceRef: null,
          version: null,
        });
        process.stderr.write(`Device command fixture: login ${folder}\n`);
        const login = await client.account.login(peer.origin);
        const url = new URL(login.url);
        const callback = new URL(url.searchParams.get("callback")!);
        callback.searchParams.set("state", url.searchParams.get("state")!);
        callback.searchParams.set("code", "one-use");
        expect((await fetch(callback)).status).toBe(200);
        process.stderr.write(`Device command fixture: sync ${folder}\n`);
        await client.account.syncProject(projectId);
        process.stderr.write(`Device command fixture: register ${folder}\n`);
        await waitFor(
          "the other device to become available",
          async () => peer.frames.filter((frame) => frame.includes('"type":"register"')).length >= (host === a ? 1 : 2),
        );
        return { client, id: identity.environmentId };
      };
      const from = await connect(a, join(root, "project-a"));
      const on = await connect(b, join(root, "project-b"));
      process.stderr.write("Device command fixture: create remote session\n");
      const session = await from.client.sessions.create(projectId, {
        deviceId: on.id,
        title: "Remote session",
        prompt: "Start",
        agent: "test.device-command-fixture.harness.worker",
      });
      await waitFor(
        "the remote turn to start",
        async () => (await on.client.sessions.get(session.id)).status === "in_progress",
      );
      const unrelated = await on.client.sessions.create(projectId, {
        title: "Unrelated",
        prompt: "Stay running",
        agent: "test.device-command-fixture.harness.worker",
      });
      await waitFor("the remote session to appear in local history", async () =>
        (await from.client.sessions.query(projectId)).items.some((row) => row.id === session.id),
      );
      const attached = await from.client.sessions.uploadAttachment(projectId, {
        name: "context.txt",
        data: new TextEncoder().encode("Remote file bytes"),
        mimeType: "text/plain",
      });
      const queued = await from.client.sessions.followUp(session.id, {
        prompt: `Long prompt: ${"a".repeat(100_000)}`,
        attachments: [{ fileId: attached.fileId }],
      });
      expect(queued.followUp.status).toBe("queued");
      expect((await on.client.sessions.getQueuedFollowUps(session.id)).requests).toEqual(
        expect.arrayContaining([expect.objectContaining({ prompt: `Long prompt: ${"a".repeat(100_000)}` })]),
      );
      await from.client.sessions.updateStatus(session.id, "cancelled");
      await waitFor(
        "the target turn to stop",
        async () => (await on.client.sessions.get(session.id)).status === "cancelled",
      );
      expect((await on.client.sessions.get(unrelated.id)).status).toBe("in_progress");
      await waitFor(
        "remote history to arrive",
        async () => (await from.client.sessions.getConversation(session.id)).messages.length > 0,
      );
      expect(peer.frames.join("")).not.toContain("Remote file bytes");
      expect(peer.frames.join("")).not.toContain("Long prompt:");
    } finally {
      polling.close();
      await stopProcess(a.child);
      if (b) await stopProcess(b.child);
      await peer.close();
      await rm(root, { recursive: true, force: true });
    }
  },
  PACKAGED_TEST_TIMEOUT,
);
