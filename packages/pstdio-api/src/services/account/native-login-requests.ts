import type { AccountSignInProvider } from "pstdio-api-contracts";
import { startNativeLogin } from "./native-login";

/** One device account owner serializes sign-in changes across all of its clients and extensions. */
type SaveLogin = Parameters<typeof startNativeLogin>[1];
export const createNativeLoginRequests = (
  save: (origin: string, ...args: Parameters<SaveLogin>) => ReturnType<SaveLogin>,
  changed: () => void,
  validateMicrosoft?: (origin: string) => Promise<void>,
) => {
  let current: { id: string; request: ReturnType<typeof startNativeLogin> } | undefined;
  let mutations = Promise.resolve();
  let closed = false;
  let generation = 0;
  const serialize = <T>(run: () => Promise<T>) => {
    const result = mutations.then(run);
    mutations = result.then(
      () => {},
      () => {},
    );
    return result;
  };
  const clear = async () => {
    if (!current) return;
    await current.request.close();
    current = undefined;
    changed();
  };
  return {
    start: async (origin: string, provider?: AccountSignInProvider) => {
      if (closed) throw new Error("Account is closed");
      const requested = ++generation;
      const validate = provider === "microsoft" ? validateMicrosoft : undefined;
      // Capability checks must not block cancellation or logout for the active callback.
      if (validate) await validate(origin);
      const assertCurrent = () => {
        if (closed) throw new Error("Account is closed");
        if (validate && requested !== generation) throw new Error("A newer account action superseded sign-in");
      };
      return serialize(async () => {
        assertCurrent();
        await clear();
        assertCurrent();
        const id = crypto.randomUUID();
        const request = startNativeLogin(origin, (...args) => save(origin, ...args), changed, provider);
        current = { id, request };
        changed();
        return { id, url: request.url };
      });
    },
    status: (id: string) => (current?.id === id ? current.request.status() : ("failed" as const)),
    failure: (id: string) => {
      const error = current?.id === id ? current.request.error() : undefined;
      return error ? { error } : {};
    },
    attempt: () => {
      if (!current) return undefined;
      const error = current.request.error();
      return { id: current.id, status: current.request.status(), ...(error && { error }) };
    },
    cancel: (id: string) =>
      serialize(async () => {
        if (current?.id !== id) return { ok: true, status: "failed" as const };
        if (current.request.status() === "complete") return { ok: false, status: "complete" as const };
        await current.request.close();
        if (current.request.status() === "complete") return { ok: false, status: "complete" as const };
        return { ok: true, status: "failed" as const };
      }),
    logout: <T>(run: () => Promise<T>) => {
      generation++;
      return serialize(async () => {
        await clear();
        return run();
      });
    },
    close() {
      closed = true;
      return serialize(clear);
    },
  };
};
