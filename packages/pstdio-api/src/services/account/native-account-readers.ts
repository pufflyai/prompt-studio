import { AccountRequestError } from "./account-errors";
import { readDeviceLogin } from "./native-device-read";
import { createFolderRecoveryReader, createNativeProjectSyncReader } from "./native-project-sync-read";

export const createNativeAccountReader = (
  store: Parameters<typeof readDeviceLogin>[0],
  environment: Parameters<typeof readDeviceLogin>[1],
) => {
  const readLogin = (deviceId?: string) => readDeviceLogin(store, environment, deviceId);
  const current = async () => {
    const login = await readLogin();
    if (!login) throw new AccountRequestError("Log in first with pst login");
    return login;
  };
  return { readLogin, current };
};
type ProjectInput = Parameters<typeof createNativeProjectSyncReader>[0];
type FolderInput = Parameters<typeof createFolderRecoveryReader>[0];
export const createNativeProjectReaders = <Owner>(input: {
  login: ProjectInput["login"];
  exists: ProjectInput["exists"];
  read: ProjectInput["read"];
  away: ProjectInput["away"];
  projectsFor: FolderInput["projectsFor"];
  folder: (id: string) => Owner | undefined;
}) => ({
  projectSyncStatus: createNativeProjectSyncReader({
    ...input,
    changed: () => new AccountRequestError("The account changed before the project sync read completed"),
    unknown: () => new AccountRequestError("Unknown project"),
  }),
  folderRecovery: createFolderRecoveryReader(input),
});
