export const createDeviceCommandPolling = (deadline: number) => {
  const controller = new AbortController();
  const cancelled = Promise.withResolvers<never>();
  controller.signal.addEventListener("abort", () => cancelled.reject(controller.signal.reason), { once: true });
  void cancelled.promise.catch(() => {});
  let timedOut = false;
  const timer = setTimeout(
    () => {
      timedOut = true;
      controller.abort(new Error("Device command fixture deadline reached"));
    },
    Math.max(0, deadline - Date.now()),
  );
  timer.unref();
  return {
    fetch: ((input: RequestInfo | URL, init?: RequestInit) =>
      fetch(input, {
        ...init,
        signal: AbortSignal.any([
          controller.signal,
          ...(input instanceof Request ? [input.signal] : []),
          ...(init?.signal ? [init.signal] : []),
        ]),
      })) as typeof fetch,
    async waitFor(label: string, read: () => Promise<boolean>) {
      try {
        while (true) {
          controller.signal.throwIfAborted();
          if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${label}`);
          if (await Promise.race([read(), cancelled.promise])) return;
          await Promise.race([Bun.sleep(25), cancelled.promise]);
        }
      } catch (error) {
        if (timedOut) throw new Error(`Timed out waiting for ${label}`, { cause: error });
        throw error;
      }
    },
    close() {
      clearTimeout(timer);
      controller.abort();
    },
  };
};
