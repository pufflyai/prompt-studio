import type { PreparationOptions } from "pstdio-extensions";
import { extensionInstallConcurrency } from "./extension-install-concurrency";
import { runExtensionPreparation } from "./extension-preparation";
import {
  type InstallExtensionSourceInput,
  type InstalledExtensionSource,
  installExtensionSource,
} from "./install-extension-source";

// A default batch keeps a bounded install pipeline inside one worker job. The
// worker environment stays fixed while dependency installs and fresh build children overlap.
export const createExtensionInstallBatch = (count: number) => {
  let remaining = count;
  const requests: {
    data: unknown;
    options: PreparationOptions;
    result: ReturnType<typeof Promise.withResolvers<InstalledExtensionSource>>;
  }[] = [];
  const ready = () => {
    if (--remaining || !requests.length) return;
    const { options } = requests[0]!;
    if (
      requests.some((request) => request.options.home !== options.home || request.options.signal !== options.signal)
    ) {
      for (const request of requests)
        request.result.reject(new Error("An install batch must share its home and cancellation owner."));
      return;
    }
    void runExtensionPreparation<
      ({ value: InstalledExtensionSource } | { error: { name: string; message: string } })[]
    >(
      "install.batch",
      requests.map((request) => request.data),
      options,
    ).then(
      (results) =>
        results.forEach((result, index) => {
          const request = requests[index]!;
          if ("error" in result) request.result.reject(Object.assign(new Error(result.error.message), result.error));
          else request.result.resolve(result.value);
        }),
      (error) =>
        requests.forEach((request) => {
          request.result.reject(error);
        }),
    );
  };
  return async (input: InstallExtensionSourceInput) => {
    let queued = false;
    try {
      return await installExtensionSource(input, (data, options) => {
        queued = true;
        const result = Promise.withResolvers<InstalledExtensionSource>();
        requests.push({ data, options, result });
        ready();
        return result.promise;
      });
    } finally {
      if (!queued) ready();
    }
  };
};

export const boundExtensionInstalls = (
  install: (input: InstallExtensionSourceInput) => Promise<InstalledExtensionSource>,
) => {
  const active = new Set<Promise<void>>();
  return async (input: InstallExtensionSourceInput) => {
    while (active.size >= extensionInstallConcurrency) await Promise.race(active);
    input.signal?.throwIfAborted();
    const result = Promise.resolve().then(() => install(input));
    const done = result
      .then(
        () => {},
        () => {},
      )
      .finally(() => {
        active.delete(done);
      });
    active.add(done);
    return result;
  };
};
