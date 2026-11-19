import { devicePresenceIntervalMs } from "pstdio-sync-contracts";
import { ManagerRequestDenied, managerRequest } from "./manager-client";

import { type DeviceLogin, matchesDeviceLogin } from "./native-store";

export const createNativePresence = (input: { denied: (login: DeviceLogin) => Promise<void> }) => {
  let closed = false;
  let active: { login: DeviceLogin; controller: AbortController; timer?: ReturnType<typeof setTimeout> } | undefined;
  const stop = () => {
    active?.controller.abort();
    clearTimeout(active?.timer);
    active = undefined;
  };
  const ping = async (state: NonNullable<typeof active>) => {
    if (active !== state) return;
    try {
      await managerRequest(
        state.login.managerOrigin,
        "/v1/devices/presence",
        state.login.token,
        {},
        state.controller.signal,
      );
    } catch (error) {
      if (state.controller.signal.aborted) return;
      if (error instanceof ManagerRequestDenied && error.status === 401) {
        stop();
        await input.denied(state.login);
        return;
      }
    }
    if (active === state) {
      state.timer = setTimeout(() => {
        void ping(state);
      }, devicePresenceIntervalMs);
      state.timer.unref?.();
    }
  };
  return {
    update(login: DeviceLogin | null) {
      if (closed) return Promise.resolve();
      if ((!active && !login) || (login && matchesDeviceLogin(active?.login, login))) return Promise.resolve();
      stop();
      if (!login) return Promise.resolve();
      active = { login, controller: new AbortController() };
      return ping(active);
    },
    close() {
      closed = true;
      stop();
    },
  };
};
