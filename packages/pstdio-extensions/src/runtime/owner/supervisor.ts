import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionDiagnostic } from "../../types/runtime";
import type { LoadedExtensionSource } from "../loader";
import { type ExtensionResourceCoordinator, extensionWorkCosts, selectExtensionResources } from "../resource-policy";
import { createOwnerEndpoint } from "./endpoint";
import { spawnExtensionOwner } from "./spawn-owner";
import { createSupervisedFunctionWrapper } from "./supervised-functions";
import { terminateOwnerProcess } from "./terminate-process";

export class ExtensionOwnerError extends Error {
  readonly code: string;
  readonly completion: "cancelled" | "unknown";
  constructor(code: string, message: string, completion: "cancelled" | "unknown" = "unknown") {
    super(message);
    this.code = code;
    this.completion = completion;
    this.name = "ExtensionOwnerError";
  }
}

const healthySourceMetadata = (source: LoadedExtensionSource | null, diagnostics: ExtensionDiagnostic[]) => {
  if (!source || diagnostics.some((item) => item.severity === "error")) return undefined;
  const { definition: _definition, ...metadata } = source;
  return metadata;
};

export const createExtensionOwner = (input: {
  path: string;
  initializationMs?: number;
  runtime?: { executable: string; packaged: boolean };
  sourceKind?: LoadedExtensionSource["sourceKind"];
  apiProvider?: "host" | "pst";
  resources?: ExtensionResourceCoordinator;
}) => {
  const resources = selectExtensionResources(input.resources);
  const cpuGroup = {};
  let child: Bun.Subprocess | undefined;
  let endpoint: ReturnType<typeof createOwnerEndpoint> | undefined;
  let loading: Promise<LoadedExtensionSource | null> | undefined;
  let initialized = false;
  let failure: ExtensionOwnerError | undefined;
  let root: string | undefined;
  let stopped = false;
  let disposed = false;
  let diagnostics: ExtensionDiagnostic[] = [];
  let prepared: { entryPath: string; packagePath: string } | undefined;
  let previous: Omit<LoadedExtensionSource, "definition"> | undefined;
  let generation = 0;
  let admission = new AbortController();
  let reaping = Promise.resolve();
  const listeners = new Set<() => void>();

  const terminate = async (error: ExtensionOwnerError) => {
    failure = error;
    const previous = child;
    reaping = Promise.all([reaping, previous?.exited]).then(() => {});
    admission.abort(error);
    admission = new AbortController();
    generation++;
    endpoint?.close(error);
    endpoint = undefined;
    child = undefined;
    initialized = false;
    loading = undefined;
    for (const dispose of listeners) dispose();
    listeners.clear();
    if (previous) await terminateOwnerProcess(previous);
    if (disposed && root) {
      const obsoleteRoot = root;
      root = undefined;
      await rm(obsoleteRoot, { recursive: true, force: true });
    }
  };

  const watchSignal = (signal: AbortSignal) => {
    signal.throwIfAborted();
    const abort = () => {
      void terminate(
        new ExtensionOwnerError(
          "extension_owner_cancelled",
          "Extension work was cancelled. Other calls sharing this source owner were interrupted.",
          "cancelled",
        ),
      );
    };
    signal.addEventListener("abort", abort, { once: true });
    const dispose = () => signal.removeEventListener("abort", abort);
    listeners.add(dispose);
    return () => {
      dispose();
      listeners.delete(dispose);
    };
  };

  // Remote functions are the only executable values delivered to the host. A signal
  // belongs to this invocation; the owner never supplies its project or permissions.
  const recoverHandler = async (path: string[], args: unknown[]) => {
    const fresh = await load();
    let replacement: unknown = fresh;
    for (const key of path) replacement = (replacement as Record<string, unknown>)[key];
    if (typeof replacement !== "function")
      throw new ExtensionOwnerError(
        "extension_owner_handler_missing",
        "The extension handler is unavailable after owner recovery.",
      );
    return replacement(...args);
  };
  const wrapFunctions = createSupervisedFunctionWrapper({
    sourcePath: input.path,
    cpuGroup,
    resources,
    isLive: () => Boolean(child),
    generation: () => generation,
    recover: recoverHandler,
    signal: () => admission.signal,
    awaitExit: () => reaping,
    watchSignal,
  });

  const prepareRoot = async (startedGeneration: number) => {
    await reaping;
    const ownerRoot = root ?? (await mkdtemp(join(tmpdir(), "pstdio-extension-owner-")));
    if (stopped || disposed || generation !== startedGeneration) {
      if (ownerRoot !== root) await rm(ownerRoot, { recursive: true, force: true });
      throw new ExtensionOwnerError("extension_owner_stopped", "Extension owner stopped during startup.", "cancelled");
    }
    return ownerRoot;
  };

  const load = () => {
    if (stopped || disposed)
      return Promise.reject(
        new ExtensionOwnerError(
          "extension_owner_stopped",
          "This extension owner is stopped. Restart it explicitly to run work.",
          "cancelled",
        ),
      );
    if (loading) return loading;
    const startedGeneration = generation;
    const initialize = async () => {
      root = await prepareRoot(startedGeneration);
      const started = spawnExtensionOwner(root, input.runtime, (message) => {
        void endpoint
          ?.receive(message)
          .catch(() =>
            terminate(new ExtensionOwnerError("extension_owner_protocol", "Extension owner sent an invalid message.")),
          );
      });
      child = started;
      endpoint = createOwnerEndpoint((message) => started.send(message));
      void started.exited.then(() => {
        if (child === started)
          void terminate(
            new ExtensionOwnerError(
              "extension_owner_exited",
              "Extension owner exited. The operation may have accepted writes; it was not retried.",
            ),
          );
      });
      const timer = setTimeout(() => {
        void terminate(
          new ExtensionOwnerError(
            "extension_owner_initialization_timeout",
            "Extension owner initialization did not finish before its deadline.",
          ),
        );
      }, input.initializationMs ?? 10_000);
      try {
        const loaded = (await endpoint.call("load", [
          { path: input.path, prepared, previous, sourceKind: input.sourceKind, apiProvider: input.apiProvider },
        ])) as {
          source: LoadedExtensionSource | null;
          diagnostics: ExtensionDiagnostic[];
          prepared?: { entryPath: string; packagePath: string };
        };
        diagnostics = loaded.diagnostics;
        const metadata = healthySourceMetadata(loaded.source, diagnostics);
        if (metadata) {
          prepared = loaded.prepared;
          previous = metadata;
        }
        initialized = true;
        failure = undefined;
        return wrapFunctions(loaded.source) as LoadedExtensionSource | null;
      } catch (error) {
        if (child === started)
          await terminate(
            new ExtensionOwnerError(
              "extension_owner_initialization_failed",
              "Extension owner initialization failed. An explicit invocation can retry.",
            ),
          );
        throw error;
      } finally {
        clearTimeout(timer);
      }
    };
    const pending = (
      resources
        ? resources.run(input.path, extensionWorkCosts.initialization, admission.signal, initialize, {
            priority: 1,
            cpuGroup,
          })
        : initialize()
    ).catch(async (error) => {
      await reaping;
      if (loading === pending) loading = undefined;
      throw error;
    });
    loading = pending;
    return loading;
  };

  return {
    sourcePath: input.path,
    get pid() {
      return child?.pid;
    },
    get diagnostics() {
      return diagnostics;
    },
    inspect: () => {
      const details = { pendingCalls: endpoint?.stats().pending ?? 0, failureCode: failure?.code };
      if (stopped || disposed) return { ...details, state: "stopped" as const };
      if (child && !initialized) return { ...details, state: "starting" as const };
      if (child) return { ...details, state: "ready" as const };
      if (failure) return { ...details, state: "failed" as const };
      return { ...details, state: "idle" as const };
    },
    load,
    stop: async () => {
      stopped = true;
      await terminate(
        new ExtensionOwnerError("extension_owner_stopped", "Extension owner stopped by the host.", "cancelled"),
      );
    },
    restart: async () => {
      stopped = true;
      const restartingGeneration = generation + 1;
      await terminate(new ExtensionOwnerError("extension_owner_restarted", "Extension owner restarted by the host."));
      if (generation !== restartingGeneration) return;
      stopped = false;
      failure = undefined;
    },
    dispose: async () => {
      disposed = true;
      await terminate(new ExtensionOwnerError("extension_owner_stopped", "Extension owner disposed.", "cancelled"));
    },
  };
};
