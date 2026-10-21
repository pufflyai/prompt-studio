import type { PstdioClient } from "@pstdio/sdk/client";
import type { ExtensionAccountApi } from "pstdio-api-contracts/extension-kernel";
import { getApiClient } from "@/lib/api";

// Webview account calls use the runtime's account routes, the same owner as `ctx.account`.
export const createAccountCapability = (projectId: string, client: Pick<PstdioClient, "account"> = getApiClient()) =>
  ({
    status: () => client.account.status(),
    login: (managerOrigin) => client.account.login(managerOrigin),
    loginStatus: async (id) => (await client.account.loginStatus(id)).status,
    cancelLogin: async (id) => (await client.account.cancelLogin(id)).status,
    logout: async () => ({ removed: (await client.account.logout()).removed }),
    devices: () => client.account.devices(),
    renameDevice: async (id, name) => {
      await client.account.renameDevice(id, name);
    },
    removeDevice: async (id) => {
      await client.account.removeDevice(id);
    },
    projectSyncStatus: (id = projectId) => client.account.projectSyncStatus(id),
    syncProject: async (id = projectId) => {
      await client.account.syncProject(id);
    },
    stopProjectSync: async (id = projectId) => {
      await client.account.stopProjectSync(id);
    },
  }) satisfies ExtensionAccountApi;
