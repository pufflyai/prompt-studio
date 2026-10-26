import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isPackagedRuntime } from "pstdio-paths";
import type { ExtensionDiagnostic } from "../../types/runtime";
import type { LoadedExtensionSource } from "../loader";
import { createExtensionProcessEnvironment } from "../process-environment";
import { createOwnerEndpoint } from "./endpoint";
import { prepareOwnerContext } from "./local-values";
import type { OwnerMessage } from "./protocol";

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

export const createExtensionOwner = (input: {
  path: string;
  initializationMs?: number;
  runtime?: { executable: string; packaged: boolean };
  sourceKind?: LoadedExtensionSource["sourceKind"];
  apiProvider?: "host" | "pst";
}) => {
  let child: Bun.Subprocess | undefined;
  let endpoint: ReturnType<typeof createOwnerEndpoint> | undefined;
  let loading: Promise<LoadedExtensionSource | null> | undefined;
  let root: string | undefined;
  let stopped = false;
  let disposed = false;
  let diagnostics: ExtensionDiagnostic[] = [];
  let prepared: { entryPath: string; packagePath: string } | undefined;
  let previous: Omit<LoadedExtensionSource, "definition"> | undefined;
  let generation = 0;
  const listeners = new Set<() => void>();

  const terminate = async (error: ExtensionOwnerError) => {
    const previous = child;
    generation++;
    endpoint?.close(error);
    endpoint = undefined;
    child = undefined;
    loading = undefined;
    for (const dispose of listeners) dispose();
    listeners.clear();
    if (previous && previous.exitCode === null) {
      if (process.platform === "win32") {
        const kill = Bun.spawn(["taskkill", "/pid", String(previous.pid), "/T", "/F"], {
          stdout: "ignore",
          stderr: "ignore",
        });
        await kill.exited;
      } else {
        try {
          process.kill(-previous.pid, "SIGKILL");
        } catch {
          previous.kill("SIGKILL");
        }
      }
      await previous.exited;
    }
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
  const wrapFunctions = (value: unknown, path: string[] = []): unknown => {
    if (typeof value === "function")
      return async (...args: unknown[]) => {
        if (!child) return recoverHandler(path, args);
        const context = args[0] as { signal?: AbortSignal } | undefined;
        const cleanup = context?.signal instanceof AbortSignal ? watchSignal(context.signal) : () => {};
        const invocation =
          context && typeof context === "object"
            ? [prepareOwnerContext(context as Record<string, unknown>), ...args.slice(1)]
            : args;
        try {
          return await value(...invocation);
        } finally {
          cleanup();
        }
      };
    if (Array.isArray(value)) return value.map((item, index) => wrapFunctions(item, [...path, String(index)]));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, wrapFunctions(item, [...path, key])]));
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
    loading = (async () => {
      const ownerRoot = root ?? (await mkdtemp(join(tmpdir(), "pstdio-extension-owner-")));
      if (stopped || disposed || generation !== startedGeneration) {
        if (ownerRoot !== root) await rm(ownerRoot, { recursive: true, force: true });
        throw new ExtensionOwnerError(
          "extension_owner_stopped",
          "Extension owner stopped during startup.",
          "cancelled",
        );
      }
      root = ownerRoot;
      const packaged = input.runtime?.packaged ?? isPackagedRuntime();
      const args = packaged
        ? ["--pstdio-extension-owner"]
        : [
            "--no-env-file",
            join(dirname(fileURLToPath(import.meta.resolve("pstdio-extensions"))), "runtime/owner/entry.ts"),
          ];
      const started = Bun.spawn([input.runtime?.executable ?? process.execPath, ...args], {
        env: createExtensionProcessEnvironment(process.env, { PSTDIO_HOME: root }),
        cwd: root,
        stdin: "ignore",
        stdout: "ignore",
        stderr: "ignore",
        detached: process.platform !== "win32",
        serialization: "json",
        ipc: (message) => {
          void endpoint
            ?.receive(message as OwnerMessage)
            .catch(() =>
              terminate(
                new ExtensionOwnerError("extension_owner_protocol", "Extension owner sent an invalid message."),
              ),
            );
        },
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
        if (loaded.source && !diagnostics.some((item) => item.severity === "error")) {
          prepared = loaded.prepared;
          const { definition: _definition, ...metadata } = loaded.source;
          previous = metadata;
        }
        return wrapFunctions(loaded.source) as LoadedExtensionSource | null;
      } finally {
        clearTimeout(timer);
      }
    })();
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
    load,
    stop: async () => {
      stopped = true;
      await terminate(
        new ExtensionOwnerError("extension_owner_stopped", "Extension owner stopped by the host.", "cancelled"),
      );
    },
    restart: async () => {
      await terminate(new ExtensionOwnerError("extension_owner_restarted", "Extension owner restarted by the host."));
      stopped = false;
    },
    dispose: async () => {
      disposed = true;
      await terminate(new ExtensionOwnerError("extension_owner_stopped", "Extension owner disposed.", "cancelled"));
    },
  };
};
