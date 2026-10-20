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
    "compiled host keeps local projects local until login and brokers native browser login",
    async () => {
      const root = mkdtempSync(join(tmpdir(), "packaged-account-"));
      let host = await startPackagedServe(root);
      try {
        let client = createClient({ baseUrl: host.baseUrl, token: host.descriptor.token });
        const loggedOut = { login: null, cloudProjects: [], cloudProjectsLoaded: true, signInAvailable: false };
        expect(await client.account.status()).toEqual(loggedOut);
        const project = await client.projects.create(folderProjectInput({ name: "Local without owner" }, root));
        expect(await client.account.projectSyncStatus(project.id)).toEqual({
          state: "saved-locally",
          offlineReady: false,
        });
        const environment = await client.runtime.environment();
        const login = await client.account.login("https://manager.fixture.test");
        const url = new URL(login.url);
        expect(url.origin).toBe("https://manager.fixture.test");
        expect(url.pathname).toBe("/v1/native-login");
        expect(new URL(url.searchParams.get("callback")!).hostname).toBe("127.0.0.1");
        expect(await client.account.loginStatus(login.id)).toEqual({ status: "pending" });
        await client.account.cancelLogin(login.id);
        expect(await client.account.loginStatus(login.id)).toEqual({ status: "failed" });
        await expect(client.account.syncProject(project.id)).rejects.toThrow();
        await expect(client.account.devices()).rejects.toThrow();
        expect(await client.account.status()).toEqual(loggedOut);
        await stopProcess(host.child);
        host = await startPackagedServe(root);
        client = createClient({ baseUrl: host.baseUrl, token: host.descriptor.token });
        expect(await client.runtime.environment()).toEqual(environment);
        expect((await client.projects.get(project.id))?.id).toBe(project.id);
        expect(await client.account.status()).toEqual(loggedOut);
        expect(await client.account.loginStatus(login.id)).toEqual({ status: "failed" });
      } finally {
        await stopProcess(host.child);
        rmSync(root, { recursive: true, force: true });
      }
    },
    PACKAGED_TEST_TIMEOUT,
  );
