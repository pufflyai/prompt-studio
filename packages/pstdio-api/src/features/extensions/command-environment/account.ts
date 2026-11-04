import type { ExtensionAccountApi } from "pstdio-api-contracts/extension-kernel";
import { CloudDeviceRequestError } from "../../../services/account/cloud-device-provider";
import { AccountRequestError, accountUnavailableMessage } from "../../../services/account/native-account";
import type { ExtensionsRouteDeps } from "../deps";

// Account service failures can name private service details. Like the account routes,
// only messages written for people reach the extension.
const safe = async <T>(request: () => Promise<T>) => {
  try {
    return await request();
  } catch (error) {
    throw error instanceof AccountRequestError || error instanceof CloudDeviceRequestError
      ? error
      : new AccountRequestError(accountUnavailableMessage);
  }
};

export const createAccountApi = (account: ExtensionsRouteDeps["accountService"], projectId: string) =>
  ({
    status: () => safe(() => account.status()),
    login: (managerOrigin) => safe(() => account.login(managerOrigin)),
    loginStatus: async (id) => account.loginStatus(id).status,
    cancelLogin: async (id) => (await safe(() => account.cancelLogin(id))).status,
    logout: async () => ({ removed: (await safe(() => account.logout())).removed }),
    devices: () => safe(() => account.devices()),
    cloudDeviceProvider: () => safe(() => account.cloudDeviceProvider()),
    configureCloudDeviceProvider: async (input) => {
      await safe(() => account.configureCloudDeviceProvider(input));
    },
    prepareCloudDeviceBootstrap: (input) => safe(() => account.prepareCloudDeviceBootstrap(input)),
    cloudDevices: () => safe(() => account.cloudDevices()),
    startCloudDevice: (input) => safe(() => account.startCloudDevice(input)),
    stopCloudDevice: (id) => safe(() => account.stopCloudDevice(id)),
    renameDevice: async (id, name) => {
      await safe(() => account.renameDevice(id, name));
    },
    removeDevice: async (id) => {
      await safe(() => account.removeDevice(id));
    },
    projectSyncStatus: (id = projectId) => safe(() => account.projectSyncStatus(id)),
    syncProject: async (id = projectId) => {
      await safe(() => account.syncProject(id));
    },
    stopProjectSync: async (id = projectId) => {
      await safe(() => account.stopProjectSync(id));
    },
  }) satisfies ExtensionAccountApi;
