import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isPackagedRuntime } from "pstdio-paths";
import { createOwnerEndpoint } from "../owner/endpoint";
import type { OwnerMessage } from "../owner/protocol";
import { createExtensionProcessEnvironment } from "../process-environment";
import { type ExtensionResourceCoordinator, extensionWorkCosts, selectExtensionResources } from "../resource-policy";
import type { PreparationOperations } from "./operations";

export const createExtensionPreparation = (
  runtime?: { executable: string; packaged: boolean },
  resources?: ExtensionResourceCoordinator,
) => {
  let child: Bun.Subprocess | undefined;
  let endpoint: ReturnType<typeof createOwnerEndpoint> | undefined;
  let reaping = Promise.resolve();
  let admission = new AbortController();

  const disposeExtensionPreparation = () => {
    const previous = child;
    child = undefined;
    const error = new Error("Extension preparation stopped; pending preparations were cancelled.");
    endpoint?.close(error);
    endpoint = undefined;
    admission.abort(error);
    admission = new AbortController();
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
    const lifetime = AbortSignal.any([admission.signal, ...(signal ? [signal] : [])]);
    const invoke = async () => {
      lifetime.throwIfAborted();
      await reaping;
      lifetime.throwIfAborted();
      const active = start();
      const abort = () => {
        if (endpoint === active) void disposeExtensionPreparation();
      };
      // This opt-in preparation deadline remains a measured rollout gate, like owner initialization.
      const deadline = setTimeout(abort, 10_000);
      lifetime.addEventListener("abort", abort, { once: true });
      try {
        return (await active.call(kind, [input])) as Awaited<ReturnType<PreparationOperations[K]>>;
      } catch (error) {
        // Callers own staging cleanup, so rejection must wait until the child stops touching it.
        await reaping;
        throw error;
      } finally {
        clearTimeout(deadline);
        lifetime.removeEventListener("abort", abort);
      }
    };
    const coordinator = selectExtensionResources(resources);
    const result = await (coordinator
      ? coordinator.run(
          typeof input === "string" ? input : input.packagePath,
          extensionWorkCosts.preparation,
          lifetime,
          invoke,
          { priority: 1, bytes: JSON.stringify(input).length * 2 },
        )
      : invoke());
    return result as Awaited<ReturnType<PreparationOperations[K]>>;
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
