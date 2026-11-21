import { managerRequest } from "./manager-client";
import type { createNativeLoginRequests } from "./native-login-requests";
import type { createNativeStore, DeviceLogin } from "./native-store";

/** Logging out works offline and after removal. Manager removal is best effort. */
export const createNativeLogout =
  (input: {
    logins: ReturnType<typeof createNativeLoginRequests>;
    readLogin(): Promise<DeviceLogin | null>;
    store: ReturnType<typeof createNativeStore>;
    refresh(): Promise<void>;
  }) =>
  () =>
    input.logins.logout(async () => {
      const login = await input.readLogin();
      if (!login) {
        await input.store.forget(null);
        await input.refresh();
        return { ok: true, removed: false };
      }
      const path = `/v1/devices/${encodeURIComponent(login.deviceId)}/remove`;
      const removed = await managerRequest(login.managerOrigin, path, login.token, {})
        .then(() => true)
        .catch(() => false);
      await input.store.forget(login.token, login);
      await input.refresh();
      return { ok: true, removed };
    });
