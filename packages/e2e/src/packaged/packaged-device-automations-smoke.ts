import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient, createRequest } from "@pstdio/sdk/client";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { PACKAGED_BINARY_PATH } from "./packaged-helpers";
import { startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { createPackagedSyncPeer } from "./packaged-sync-relay.fixture";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

export const registerDeviceAutomationSmokeTests = () =>
  test(
    // Assignments are records, which stay on their device until per-record sync exists (ADR 0100).
    "compiled hosts keep device assignments after restart and never send them in plain text",
    async () => {
      const root = await mkdtemp(join(tmpdir(), "packaged-device-automations-"));
      const key = join(root, "key.pem");
      const cert = join(root, "cert.pem");
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
      await Bun.write(
        join(source, "package.json"),
        JSON.stringify({
          name: "clock",
          publisher: "test",
          version: "1.0.0",
          type: "module",
          main: "extension.ts",
          engines: { pstdio: `^${EXTENSION_API_VERSION}` },
        }),
      );
      await Bun.write(
        join(source, "extension.ts"),
        `export default {
      commands: [{ id: "tick", ref: { kind: "command", id: "tick" }, title: "Tick", run() {} }],
      schedules: [{ id: "tick", ref: { kind: "schedule", id: "tick" }, title: "Tick", schedule: "0 0 1 1 *",
        command: { kind: "command", id: "tick" } }],
    };`,
      );
      const roots = [join(root, "a"), join(root, "b")];
      await Promise.all(roots.map((path) => mkdir(path)));
      const env = {
        NODE_EXTRA_CA_CERTS: cert,
        PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify([{ source, installName: "clock" }]),
      };
      const hosts: Awaited<ReturnType<typeof startPackagedServe>>[] = [];
      try {
        const started = await Promise.allSettled(roots.map((path) => startPackagedServe(path, env)));
        for (const result of started) if (result.status === "fulfilled") hosts.push(result.value);
        for (const result of started) if (result.status === "rejected") throw result.reason;
        const projectId = crypto.randomUUID();
        const clients = hosts.map((host) => createClient({ baseUrl: host.baseUrl, token: host.descriptor.token }));
        const requests = hosts.map((host) => createRequest({ baseUrl: host.baseUrl, token: host.descriptor.token }));
        const deviceIds: string[] = [];
        const instanceIds: string[] = [];
        for (const [index, client] of clients.entries()) {
          const identity = await requests[index]!<{ environmentId: string }>("/v1/environment");
          deviceIds.push(identity.environmentId);
          const folder = join(roots[index]!, "project");
          await mkdir(folder);
          await requests[index]!(`/v1/projects/${projectId}/environment-binding`, {
            method: "PUT",
            body: {
              ...identity,
              name: "Clock",
              initial_workspace: { provider_id: "pstdio.root", params: { path: folder } },
            },
          });
          // Binding a remote project does not enable the local test source automatically.
          const installed = await requests[index]!<{ instanceId: string }>(
            `/v1/projects/${projectId}/extensions/installed/clock/enable`,
            {
              method: "POST",
              body: {
                displayName: "Clock",
                extensionId: "test.clock",
                name: "clock",
                manifest: { name: "clock" },
                sourceKind: "local_path",
                sourcePath: source,
                sourceHash: null,
                sourceRef: null,
                version: null,
              },
            },
          );
          instanceIds.push(installed.instanceId);
          const login = await client.account.login(peer.origin);
          const url = new URL(login.url);
          const callback = new URL(url.searchParams.get("callback")!);
          callback.searchParams.set("state", url.searchParams.get("state")!);
          callback.searchParams.set("code", "one-use");
          expect((await fetch(callback)).status).toBe(200);
          await client.account.syncProject(projectId);
        }
        expect(deviceIds[0]).not.toBe(deviceIds[1]);
        await requests[0]!(
          `/v1/projects/${projectId}/extensions/${instanceIds[0]}/automations/test.clock.schedule.tick`,
          {
            method: "PATCH",
            body: { enabled: false },
          },
        );
        const path = `/v1/projects/${projectId}/extensions/automations`;
        const assigned = await requests[0]!(path, {
          method: "POST",
          body: { scheduleId: "test.clock.schedule.tick", deviceId: deviceIds[0] },
        });
        expect(assigned).toMatchObject({ enabled: false });
        expect(await requests[0]!(`${path}/runs`)).toEqual([]);
        const cli = Bun.spawn([PACKAGED_BINARY_PATH, "extensions", "automations", "list", "--project-id", projectId], {
          cwd: roots[0],
          env: { ...process.env, PSTDIO_API_URL: hosts[0]!.baseUrl, PSTDIO_API_TOKEN: hosts[0]!.descriptor.token },
          stdout: "pipe",
          stderr: "pipe",
        });
        const output = await new Response(cli.stdout).text();
        expect(await cli.exited).toBe(0);
        expect(JSON.parse(output)).toEqual([assigned]);
        await stopProcess(hosts[0]!.child);
        hosts[0] = await startPackagedServe(roots[0]!, env);
        const restarted = createRequest({ baseUrl: hosts[0].baseUrl, token: hosts[0].descriptor.token });
        expect(await restarted(path)).toEqual([assigned]);
        expect(await restarted(`${path}/runs`)).toEqual([]);
        const wire = JSON.stringify(
          [...peer.documents.values()].map((document) => ({
            payload: document.payload,
            updates: document.updates.map((update) => update.payload),
          })),
        );
        expect(wire).not.toContain("test.clock.schedule.tick");
        expect(wire).not.toContain(deviceIds[0]!);
      } finally {
        await Promise.all(hosts.map((host) => stopProcess(host.child)));
        await peer.stop();
        await rm(root, { recursive: true, force: true });
      }
    },
    PACKAGED_TEST_TIMEOUT,
  );
