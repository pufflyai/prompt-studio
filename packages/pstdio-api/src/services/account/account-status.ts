import type { createNativeStore, DeviceLogin } from "./native-store";

/** Only the native owner reads credentials; the account response carries safe identity fields. */
export const readAccountStatus = async (
  store: ReturnType<typeof createNativeStore>,
  login: DeviceLogin | null,
  cloudProjects: { credential: string; ids: string[]; features: { relay: boolean } } | undefined,
  deviceId: string,
  cached?: (login: DeviceLogin) => Promise<string[] | undefined>,
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
  const ids = known?.ids ?? (await cached?.(login));
  return {
    login: device,
    cloudProjects: ids ?? [],
    cloudProjectsLoaded: ids !== undefined,
    features: known?.features ?? null,
  };
};
