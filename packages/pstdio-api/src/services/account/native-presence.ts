import { devicePresenceIntervalMs } from "pstdio-sync-contracts";
import { ManagerRequestDenied, managerRequest } from "./manager-client";

interface PresenceLogin {
  token: string;
  managerOrigin: string;
}

export const createNativePresence = (input: { denied: (credential: string) => Promise<void> }) => {
  let closed = false;
  let active: { login: PresenceLogin; controller: AbortController; timer?: ReturnType<typeof setTimeout> } | undefined;
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
        await input.denied(state.login.token);
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
    update(login: PresenceLogin | null) {
      if (closed) return Promise.resolve();
      if (active?.login.token === login?.token) return Promise.resolve();
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
