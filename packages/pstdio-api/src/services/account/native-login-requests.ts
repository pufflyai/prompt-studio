import { startNativeLogin } from "./native-login";

/** One device account owner serializes sign-in changes across all of its clients and extensions. */
type SaveLogin = Parameters<typeof startNativeLogin>[1];
export const createNativeLoginRequests = (
  save: (origin: string, ...args: Parameters<SaveLogin>) => ReturnType<SaveLogin>,
  changed: () => void,
) => {
  let current: { id: string; request: ReturnType<typeof startNativeLogin> } | undefined;
  let mutations = Promise.resolve();
  let closed = false;
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
    start: (origin: string) =>
      serialize(async () => {
        if (closed) throw new Error("Account is closed");
        await clear();
        const id = crypto.randomUUID();
        const request = startNativeLogin(origin, (...args) => save(origin, ...args), changed);
        current = { id, request };
        changed();
        return { id, url: request.url };
      }),
    status: (id: string) => (current?.id === id ? current.request.status() : ("failed" as const)),
    attempt: () => (current ? { id: current.id, status: current.request.status() } : undefined),
    cancel: (id: string) =>
      serialize(async () => {
        if (current?.id !== id) return { ok: true, status: "failed" as const };
        if (current.request.status() === "complete") return { ok: false, status: "complete" as const };
        await current.request.close();
        if (current.request.status() === "complete") return { ok: false, status: "complete" as const };
        return { ok: true, status: "failed" as const };
      }),
    logout: <T>(run: () => Promise<T>) =>
      serialize(async () => {
        await clear();
        return run();
      }),
    close() {
      closed = true;
      return serialize(clear);
    },
  };
};
