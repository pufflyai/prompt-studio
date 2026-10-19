import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@pstdio/sdk/client";
import { folderProjectInput } from "../helpers/folder-project";
import { startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

export const registerAccountSmokeTests = () =>
  test(
    "compiled account host keeps local workbenches independent and brokers native browser login",
    async () => {
      const root = mkdtempSync(join(tmpdir(), "packaged-account-"));
      let host = await startPackagedServe(root);
      try {
        let client = createClient({ baseUrl: host.baseUrl, token: host.descriptor.token });
        expect(await client.account.connections()).toEqual([]);
        const project = await client.projects.create(folderProjectInput({ name: "Local without owner" }, root));
        const environment = await client.runtime.environment();
        const login = await client.account.login("https://manager.fixture.test");
        const url = new URL(login.url);
        expect(url.origin).toBe("https://manager.fixture.test");
        expect(url.pathname).toBe("/v1/native-login");
        expect(new URL(url.searchParams.get("callback")!).hostname).toBe("127.0.0.1");
        expect(await client.account.loginStatus(login.id)).toEqual({ status: "pending" });
        await expect(
          client.account.connect(project.id, {
            accountId: "not-signed-in",
            managerOrigin: "https://manager.fixture.test",
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          }),
        ).rejects.toThrow();
        expect(await client.account.connections()).toEqual([]);
        await stopProcess(host.child);
        host = await startPackagedServe(root);
        client = createClient({ baseUrl: host.baseUrl, token: host.descriptor.token });
        expect(await client.runtime.environment()).toEqual(environment);
        expect((await client.projects.get(project.id))?.id).toBe(project.id);
        expect(await client.account.connections()).toEqual([]);
        expect(await client.account.loginStatus(login.id)).toEqual({ status: "failed" });
      } finally {
        await stopProcess(host.child);
        rmSync(root, { recursive: true, force: true });
      }
    },
    PACKAGED_TEST_TIMEOUT,
  );
