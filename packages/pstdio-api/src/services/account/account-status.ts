import type { createNativeStore, DeviceLogin } from "./native-store";

/** Only the native owner reads credentials; the account response carries safe identity fields. */
export const readAccountStatus = async (
  store: ReturnType<typeof createNativeStore>,
  login: DeviceLogin | null,
  cloudProjects: { credential: string; ids: string[]; features: { relay: boolean } } | undefined,
  deviceId: string,
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
  const known = cloudProjects?.credential === token ? cloudProjects : undefined;
  return {
    login: device,
    cloudProjects: known?.ids ?? [],
    cloudProjectsLoaded: known !== undefined,
    features: known?.features ?? null,
  };
};
