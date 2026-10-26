import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isPackagedRuntime } from "pstdio-paths";
import { createOwnerEndpoint } from "../owner/endpoint";
import type { OwnerMessage } from "../owner/protocol";
import { createExtensionProcessEnvironment } from "../process-environment";
import type { PreparationOperations } from "./operations";

export const createExtensionPreparation = (runtime?: { executable: string; packaged: boolean }) => {
  let child: Bun.Subprocess | undefined;
  let endpoint: ReturnType<typeof createOwnerEndpoint> | undefined;
  let reaping = Promise.resolve();

  const disposeExtensionPreparation = () => {
    const previous = child;
    child = undefined;
    endpoint?.close(new Error("Extension preparation stopped; pending preparations were cancelled."));
    endpoint = undefined;
    const exited = (async () => {
      if (previous && previous.exitCode === null) {
        previous.kill("SIGKILL");
        await previous.exited;
      }
    })();
    reaping = Promise.all([reaping, exited]).then(() => {});
    return reaping;
  };

  const start = () => {
    if (endpoint) return endpoint;
    const args =
      (runtime?.packaged ?? isPackagedRuntime())
        ? ["--pstdio-extension-preparation"]
        : [
            "--no-env-file",
            join(dirname(fileURLToPath(import.meta.resolve("pstdio-extensions"))), "runtime/preparation/entry.ts"),
          ];
    const started = Bun.spawn([runtime?.executable ?? process.execPath, ...args], {
      cwd: process.cwd(),
      env: createExtensionProcessEnvironment(process.env, { PSTDIO_HOME: process.env.PSTDIO_HOME }),
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
      serialization: "json",
      ipc: (message) => {
        if (child === started) void endpoint?.receive(message as OwnerMessage).catch(disposeExtensionPreparation);
      },
    });
    child = started;
    endpoint = createOwnerEndpoint((message) => started.send(message));
    void started.exited.then(() => {
      if (child === started) void disposeExtensionPreparation();
    });
    return endpoint;
  };

  const prepareExtensionWork = async <K extends keyof PreparationOperations>(
    kind: K,
    input: Parameters<PreparationOperations[K]>[0],
    signal?: AbortSignal,
  ): Promise<Awaited<ReturnType<PreparationOperations[K]>>> => {
    signal?.throwIfAborted();
    await reaping;
    signal?.throwIfAborted();
    const active = start();
    const abort = () => {
      if (endpoint === active) void disposeExtensionPreparation();
    };
    // This opt-in preparation deadline remains a measured rollout gate, like owner initialization.
    const deadline = setTimeout(abort, 10_000);
    signal?.addEventListener("abort", abort, { once: true });
    try {
      return (await active.call(kind, [input])) as Awaited<ReturnType<PreparationOperations[K]>>;
    } catch (error) {
      // Callers own staging cleanup, so rejection must wait until the child stops touching it.
      await reaping;
      throw error;
    } finally {
      clearTimeout(deadline);
      signal?.removeEventListener("abort", abort);
    }
  };
  return {
    run: prepareExtensionWork,
    dispose: disposeExtensionPreparation,
    get pid() {
      return child?.pid;
    },
  };
};

const sharedPreparation = createExtensionPreparation();
export const extensionPreparationPid = () => sharedPreparation.pid;
export const prepareExtensionWork = sharedPreparation.run;
export const disposeExtensionPreparation = sharedPreparation.dispose;
