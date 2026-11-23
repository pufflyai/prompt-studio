import type { ExtensionDiagnosticsApi } from "pstdio-api-contracts/extension-kernel";
import { captureBackendDiagnostic } from "pstdio-diagnostics";
import type { InvocationScope } from "pstdio-extensions";
import { isFirstPartyExtension } from "../project-extension-instance";

/**
 * Profiling exposes host internals such as source paths, call stacks and runtime identifiers, so
 * only first-party extensions from the packaged catalog may capture.
 */
export const createDiagnosticsApi = (extensionId: string, scope?: InvocationScope) =>
  ({
    capture: async (input) => {
      if (!isFirstPartyExtension(extensionId))
        throw Object.assign(new Error(`${extensionId} may not profile the Prompt Studio host.`), {
          code: "diagnostics_forbidden",
        });
      // A capture ends with the invocation that started it, so a stopped worker cannot leave the profiler running.
      const ended = new AbortController();
      scope?.register(() => ended.abort(new Error("The invocation that started the capture ended.")));
      const signals = [ended.signal, scope?.signal, input.signal].filter((signal) => signal !== undefined);
      return captureBackendDiagnostic({ ...input, signal: AbortSignal.any(signals) });
    },
  }) satisfies ExtensionDiagnosticsApi;
