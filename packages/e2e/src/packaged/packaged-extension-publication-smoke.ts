import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { applyRecordChange, blankRecord } from "pstdio-sync";
import { fingerprint, publishedExtensionsId, sealMutation } from "pstdio-sync-contracts";
import { folderProjectInput } from "../helpers/folder-project";
import { createNativeRelayPeer } from "./native-relay-peer.fixture";
import { PACKAGED_BINARY_PATH } from "./packaged-helpers";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

export const registerExtensionPublicationSmokeTests = () => {
  test(
    "compiled CLI publishes immutable packages and explicitly adopts relay-accepted revisions",
    async () => {
      const root = mkdtempSync(join(tmpdir(), "packaged-extension-publication-"));
      const home = join(root, "home");
      const repo = join(root, "repo");
      const source = join(root, "source");
      for (const path of [home, repo, source]) mkdirSync(path);
      writeFileSync(
        join(source, "package.json"),
        JSON.stringify({
          name: "unrelated",
          publisher: "example",
          version: "1.0.0",
          main: "extension.ts",
          engines: { pstdio: `^${EXTENSION_API_VERSION}` },
        }),
      );
      writeFileSync(join(source, "extension.ts"), "export default {};");
      let peer: ReturnType<typeof createNativeRelayPeer> | undefined;
      let host = await startPackagedServe(home, { PSTDIO_DEFAULT_EXTENSIONS: "[]" });
      try {
        const response = await fetch(`${host.baseUrl}/v1/projects`, {
          method: "POST",
          headers: { ...runtimeAuthorization(host.descriptor), "content-type": "application/json" },
          body: JSON.stringify(folderProjectInput({ name: "Publication" }, repo)),
        });
        expect(response.status).toBe(201);
        const project = (await response.json()) as { id: string };
        mkdirSync(join(repo, ".pstdio"), { recursive: true });
        writeFileSync(join(repo, ".pstdio", "config.json"), JSON.stringify({ project_id: project.id }));
        const run = (...args: string[]) => {
          const result = spawnSync(PACKAGED_BINARY_PATH, args, {
            cwd: repo,
            env: {
              ...process.env,
              PSTDIO_HOME: home,
              PSTDIO_API_URL: host.baseUrl,
              PSTDIO_API_TOKEN: host.descriptor.token,
            },
            encoding: "utf8",
          });
          if (result.status !== 0) throw new Error(result.stderr || result.stdout);
          return result.stdout;
        };
        run("extensions", "add", source, "--name", "unrelated", "--skip-install");
        const before = JSON.parse(run("extensions", "publication", "list"));
        expect(before[0].value).toBe(null);
        const saved = JSON.parse(run("extensions", "publication", "publish", "unrelated"));
        expect(saved.status).toBe("saved-locally");
        const after = JSON.parse(run("extensions", "publication", "list"));
        expect(after[0].value.revision).toBe(after[0].asset.sha256);
        expect(after[0].accepted).toBe(null);
        const headers = runtimeAuthorization(host.descriptor);
        const initialSources = (await (
          await fetch(`${host.baseUrl}/v1/projects/${project.id}/extensions`, { headers })
        ).json()) as { extensions: { id: string; sourcePath: string }[] };
        const environment = (await (await fetch(`${host.baseUrl}/v1/environment`, { headers })).json()) as {
          environmentId: string;
        };
        const scope = { accountId: "owned-wire-peer", workbenchId: project.id, extensionId: publishedExtensionsId };
        const change = {
          recordId: after[0].recordId as string,
          expectedRevision: 0,
          baseDeleted: false,
          value: { expected: await fingerprint(null), next: after[0].value },
          asset: { base: null, next: after[0].asset },
        };
        const mutation = await sealMutation({
          protocolVersion: 1,
          scope,
          operationId: saved.operationId,
          environmentId: environment.environmentId,
          parents: [],
          changes: [change],
        });
        const checkpoint = { epoch: "published", sequence: 1 };
        peer = createNativeRelayPeer({
          protocolVersion: 1,
          scope,
          publishedRevision: "published-extensions-v1",
          checkpoint,
          journalSequence: 1,
          records: { [change.recordId]: applyRecordChange(blankRecord(change.recordId), change) },
          receipts: {
            [mutation.operationId]: {
              order: 1,
              operationId: mutation.operationId,
              fingerprint: mutation.fingerprint,
              mutation,
              status: "accepted",
              checkpoint,
            },
          },
          conflicts: {},
        });
        const config = join(home, "relay.json");
        writeFileSync(
          config,
          JSON.stringify({
            connections: [
              {
                accountId: scope.accountId,
                workbenchId: project.id,
                environmentId: environment.environmentId,
                relayOrigin: peer.url.origin,
                managerOrigin: peer.url.origin,
                renewalGrant: "owned-renewal-fixture",
              },
            ],
          }),
        );
        await stopProcess(host.child);
        host = await startPackagedServe(home, { PSTDIO_DEFAULT_EXTENSIONS: "[]", PSTDIO_RELAY_CONFIG_FILE: config });
        const catalog = async () =>
          (await (
            await fetch(`${host.baseUrl}/v1/projects/${project.id}/extension-publications`, {
              headers: runtimeAuthorization(host.descriptor),
            })
          ).json()) as { accepted: { revision: string } | null }[];
        const deadline = Date.now() + 2000;
        while (!(await catalog())[0]?.accepted && Date.now() < deadline) await Bun.sleep(10);
        expect((await catalog())[0]?.accepted?.revision).toBe(after[0].asset.sha256);
        expect(JSON.parse(run("extensions", "publication", "adopt", "example.unrelated")).status).toBe("active");
        const adoptedSources = (await (
          await fetch(`${host.baseUrl}/v1/projects/${project.id}/extensions`, {
            headers: runtimeAuthorization(host.descriptor),
          })
        ).json()) as { extensions: { id: string; sourcePath: string }[] };
        expect(adoptedSources.extensions[0]!.id).toBe(initialSources.extensions[0]!.id);
        expect(adoptedSources.extensions[0]!.sourcePath).not.toBe(initialSources.extensions[0]!.sourcePath);
      } finally {
        await stopProcess(host.child);
        await peer?.stop(true);
        rmSync(root, { recursive: true, force: true });
      }
    },
    PACKAGED_TEST_TIMEOUT,
  );
};
