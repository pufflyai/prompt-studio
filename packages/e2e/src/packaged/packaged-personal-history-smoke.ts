import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@pstdio/sdk/client";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { createPackagedSyncPeer } from "./packaged-sync-relay.fixture";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

const waitFor = async (condition: () => Promise<boolean>) => {
  while (!(await condition())) await Bun.sleep(25);
};
export const registerPersonalHistorySmokeTests = () =>
  test(
    "compiled devices read full personal conversations after the source stops and the reader restarts offline",
    async () => {
      const root = await mkdtemp(join(tmpdir(), "packaged-personal-history-"));
      const key = join(root, "peer-key.pem");
      const cert = join(root, "peer-cert.pem");
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
      const peer = createPackagedSyncPeer({ key: Bun.file(key), cert: Bun.file(cert) });
      const source = join(root, "harness");
      await mkdir(source);
      await Bun.write(
        join(source, "package.json"),
        JSON.stringify({
          name: "personal-history-fixture",
          publisher: "test",
          version: "1.0.0",
          main: "extension.ts",
          engines: { pstdio: `^${EXTENSION_API_VERSION}` },
        }),
      );
      await Bun.write(
        join(source, "extension.ts"),
        `export default { harnesses: [{ id: "worker", ref: { kind: "harness", id: "worker" }, label: "Worker", capabilities: () => [], start(_ctx, input) {
    for (let index = 0; index < 600; index++) input.events.push({ op: "add", path: "/messages/" + index, value: { id: "message-" + index, role: "assistant", parts: [{ type: "text", text: "packaged-secret transcript " + index }] } });
    return { agentSessionId: "native", done: Promise.resolve({ status: "completed" }), stop() {} };
  }, resume() { throw new Error("Read only"); }, getMessages() { return []; }, recoverMessages(_ctx, input) { return { kind: "recovered", messages: input.knownMessages }; } }] };`,
      );
      const roots = [join(root, "a"), join(root, "b")];
      for (const path of roots) await mkdir(path);
      const env = {
        NODE_EXTRA_CA_CERTS: cert,
        PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify([{ source, installName: "personal-history-fixture" }]),
      };
      const a = await startPackagedServe(roots[0]!, env);
      let b: Awaited<ReturnType<typeof startPackagedServe>> | undefined;
      const projectId = crypto.randomUUID();
      const connect = async (host: typeof a, folder: string) => {
        const client = createClient({ baseUrl: host.baseUrl, token: host.descriptor.token });
        await mkdir(folder);
        const identity = await client.runtime.environment();
        const response = await fetch(`${host.baseUrl}/v1/projects/${projectId}/environment-binding`, {
          method: "PUT",
          headers: { ...runtimeAuthorization(host.descriptor), "content-type": "application/json" },
          body: JSON.stringify({
            ...identity,
            name: "Personal history",
            initial_workspace: { provider_id: "pstdio.root", params: { path: folder } },
          }),
        });
        expect(response.status).toBe(201);
        await client.extensions.enableInstalled(projectId, "personal-history-fixture", {
          displayName: "Personal history fixture",
          extensionId: "test.personal-history-fixture",
          name: "personal-history-fixture",
          manifest: { name: "personal-history-fixture" },
          sourceKind: "local_path",
          sourcePath: source,
          sourceHash: null,
          sourceRef: null,
          version: null,
        });
        const login = await client.account.login(peer.server.url.origin);
        const url = new URL(login.url);
        const callback = new URL(url.searchParams.get("callback")!);
        callback.searchParams.set("state", url.searchParams.get("state")!);
        callback.searchParams.set("code", "one-use");
        expect((await fetch(callback)).status).toBe(200);
        await client.account.syncProject(projectId);
        return client;
      };
      try {
        const clientA = await connect(a, join(roots[0]!, "project"));
        const session = await clientA.sessions.create({
          projectId,
          title: "Private conversation",
          agent: "test.personal-history-fixture.harness.worker",
          prompt: "Start",
        });
        await waitFor(async () => (await clientA.sessions.get(session.id))?.status === "completed");
        await waitFor(async () => {
          const documents = peer.personalDocuments();
          return documents.length >= 2 && documents.every((document) => document.state || document.updates.length > 0);
        });
        await stopProcess(a.child);
        b = await startPackagedServe(roots[1]!, env);
        let clientB = await connect(b, join(roots[1]!, "project"));
        await waitFor(async () => (await clientB.sessions.query(projectId)).items.some((row) => row.id === session.id));
        await waitFor(async () => (await clientB.sessions.getConversation(session.id)).messages.length === 600);
        await stopProcess(b.child);
        await peer.server.stop(true);
        b = await startPackagedServe(roots[1]!, env);
        clientB = createClient({ baseUrl: b.baseUrl, token: b.descriptor.token });
        const conversation = await clientB.sessions.getConversation(session.id);
        expect(conversation.messages).toHaveLength(600);
        expect(conversation.messages.at(-1)).toMatchObject({
          parts: [{ type: "text", text: "packaged-secret transcript 599" }],
        });
        expect(conversation.session.device?.ownerId).toBe("owner");
        expect(JSON.stringify([...peer.documents.values()])).not.toContain("packaged-secret");
      } finally {
        await stopProcess(a.child);
        if (b) await stopProcess(b.child);
        await peer.server.stop(true);
        await rm(root, { recursive: true, force: true });
      }
    },
    PACKAGED_TEST_TIMEOUT,
  );
