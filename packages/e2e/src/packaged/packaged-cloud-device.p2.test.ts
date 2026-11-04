import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
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

// The manager is a disposable wire fixture; real enrollment authorization and
// crash recovery run against PostgreSQL in account-manager's integration suite.
test(
  "a compiled cloud device enrolls, receives encrypted session commands and preserves its identity after restart",
  async () => {
    const root = await mkdtemp(join(tmpdir(), "packaged-cloud-device-"));
    const polling = createDeviceCommandPolling(Date.now() + PACKAGED_TEST_TIMEOUT - 5_000);
    const key = join(root, "key.pem"),
      cert = join(root, "cert.pem");
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
    let caller: Awaited<ReturnType<typeof startPackagedServe>> | undefined;
    let target: typeof caller;
    try {
      await mkdir(source);
      await Bun.write(
        join(source, "package.json"),
        JSON.stringify({
          name: "cloud-command-fixture",
          publisher: "test",
          version: "1.0.0",
          main: "extension.ts",
          engines: { pstdio: `^${EXTENSION_API_VERSION}` },
        }),
      );
      await Bun.write(
        join(source, "extension.ts"),
        `const start = (_ctx, input) => {
      input.events.push({ op: "add", path: "/messages/0", value: { id: "first", role: "assistant", parts: [{type: "text", text: "Cloud fixture is running"}] } });
      let finish; return { agentSessionId: crypto.randomUUID(), done: new Promise(r => { finish = r; }), stop() { finish({status: "cancelled"}); } };
    };
    export default { harnesses: [{ id: "worker", ref: { kind: "harness", id: "worker" }, label: "Worker", capabilities: () => [], start, resume: start, getMessages: () => [], recoverMessages(_ctx, input) { return {kind: "recovered", messages: input.knownMessages}; } }] };`,
      );
      const env = {
        NODE_EXTRA_CA_CERTS: cert,
        PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify([{ source, installName: "cloud-command-fixture" }]),
      };
      const callerRoot = join(root, "caller"),
        targetRoot = join(root, "target");
      await Promise.all([mkdir(callerRoot), mkdir(targetRoot)]);
      caller = await startPackagedServe(callerRoot, env);
      const client = (host: NonNullable<typeof caller>) =>
        createClient({ baseUrl: host.baseUrl, token: host.descriptor.token, fetch: polling.fetch });
      const from = client(caller);
      const login = await from.account.login(peer.origin);
      const loginUrl = new URL(login.url),
        callback = new URL(loginUrl.searchParams.get("callback")!);
      callback.searchParams.set("state", loginUrl.searchParams.get("state")!);
      callback.searchParams.set("code", "one-use");
      expect((await fetch(callback)).status).toBe(200);
      const prepared = await from.account.prepareCloudDeviceBootstrap({ name: "Cloud worker" });
      if (process.platform !== "win32") expect((await stat(prepared.path)).mode & 0o777).toBe(0o600);
      target = await startPackagedServe(targetRoot, { ...env, PSTDIO_CLOUD_BOOTSTRAP_FILE: prepared.path });
      const on = client(target);
      expect((await on.runtime.environment()).environmentId).toBe(prepared.deviceId);
      expect((await from.runtime.environment()).environmentId).not.toBe(prepared.deviceId);
      expect(peer.enrolled()).toBe(1);
      await expect(stat(prepared.path)).rejects.toMatchObject({ code: "ENOENT" });
      const privateLogin = async (path: string) =>
        JSON.parse(await readFile(join(path, "native-account.json"), "utf8")).login;
      const credential = (await privateLogin(targetRoot)).token;
      expect(credential).not.toBe((await privateLogin(callerRoot)).token);
      expect((await from.account.devices()).find((device) => device.id === prepared.deviceId)).toMatchObject({
        name: "Cloud worker",
        online: true,
      });
      const projectId = crypto.randomUUID();
      for (const [host, api, folder] of [
        [caller, from, join(root, "project-caller")],
        [target, on, join(root, "project-target")],
      ] as const) {
        await mkdir(folder);
        const identity = await api.runtime.environment();
        expect(
          (
            await polling.fetch(`${host.baseUrl}/v1/projects/${projectId}/environment-binding`, {
              method: "PUT",
              headers: { ...runtimeAuthorization(host.descriptor), "content-type": "application/json" },
              body: JSON.stringify({
                ...identity,
                name: "Cloud fixture",
                initial_workspace: { provider_id: "pstdio.root", params: { path: folder } },
              }),
            })
          ).status,
        ).toBe(201);
        await api.extensions.enableInstalled(projectId, "cloud-command-fixture", {
          displayName: "Cloud fixture",
          extensionId: "test.cloud-command-fixture",
          name: "cloud-command-fixture",
          manifest: { name: "cloud-command-fixture" },
          sourceKind: "local_path",
          sourcePath: source,
          sourceHash: null,
          sourceRef: null,
          version: null,
        });
      }
      await from.account.syncProject(projectId);
      await on.account.syncProject(projectId);
      await polling.waitFor(
        "both compiled devices to register commands",
        async () => peer.frames.filter((frame) => frame.includes('"type":"register"')).length >= 2,
      );
      expect(peer.keyDevices.has(prepared.deviceId)).toBe(true);
      const session = await from.sessions.create(projectId, {
        deviceId: prepared.deviceId,
        title: "Cloud session",
        prompt: "Start cloud work",
        agent: "test.cloud-command-fixture.harness.worker",
      });
      await polling.waitFor(
        "the cloud turn to start",
        async () => (await on.sessions.get(session.id)).status === "in_progress",
      );
      await polling.waitFor("cloud history on the caller", async () =>
        (await from.sessions.query(projectId)).items.some((row) => row.id === session.id),
      );
      expect((await from.sessions.followUp(session.id, { prompt: "Continue cloud work" })).followUp.status).toBe(
        "queued",
      );
      expect((await on.sessions.getQueuedFollowUps(session.id)).requests).toEqual(
        expect.arrayContaining([expect.objectContaining({ prompt: "Continue cloud work" })]),
      );
      await from.sessions.updateStatus(session.id, "cancelled");
      await polling.waitFor(
        "the cloud turn to stop",
        async () => (await on.sessions.get(session.id)).status === "cancelled",
      );
      expect(peer.frames.join("")).not.toContain("Continue cloud work");
      await stopProcess(target.child);
      target = undefined;
      target = await startPackagedServe(targetRoot, { ...env, PSTDIO_CLOUD_BOOTSTRAP_FILE: prepared.path });
      expect((await client(target).runtime.environment()).environmentId).toBe(prepared.deviceId);
      expect((await privateLogin(targetRoot)).token).toBe(credential);
      expect(peer.enrolled()).toBe(1);
    } finally {
      polling.close();
      if (target) await stopProcess(target.child);
      if (caller) await stopProcess(caller.child);
      await peer.close();
      await rm(root, { recursive: true, force: true });
    }
  },
  PACKAGED_TEST_TIMEOUT,
);
