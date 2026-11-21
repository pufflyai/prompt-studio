import { matchesManagerLogin, type readManagerAccount } from "./manager-account";
import type { createNativeStore, DeviceLogin } from "./native-store";

/** Only the native owner reads credentials; the account response carries safe identity fields. */
export const readAccountStatus = async (
  store: ReturnType<typeof createNativeStore>,
  login: DeviceLogin | null,
  cloudProjects: Awaited<ReturnType<typeof readManagerAccount>> | undefined,
  deviceId: string,
  cached?: (login: DeviceLogin) => Promise<string[] | undefined>,
  online = false,
) => {
  if (!login)
    return {
      login: null,
      cloudProjects: [] as string[],
      cloudProjectsLoaded: true,
      features: null,
      ...((await store.signInRequired(deviceId)) && { signInRequired: true }),
    };
  const { token, ...device } = login;
  const known = matchesManagerLogin(cloudProjects, login) ? cloudProjects : undefined;
  const ids = known?.ids ?? (await cached?.(login));
  return {
    login: device,
    cloudProjects: ids ?? [],
    cloudProjectsLoaded: Boolean(known && online),
    features: known?.features ?? null,
  };
};
