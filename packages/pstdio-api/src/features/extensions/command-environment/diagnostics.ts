import { realpathSync } from "node:fs";
import { canonicalExtensionId } from "pstdio-api-contracts/extension-host";
import type { ExtensionDiagnosticsApi } from "pstdio-api-contracts/extension-kernel";
import { captureBackendDiagnostic } from "pstdio-diagnostics";
import type { InvocationScope } from "pstdio-extensions";
import { parseRegistrySourceRef } from "pstdio-extensions/distribution";
import { parseExtensionSourceRef } from "../../../services/extension-source-ref";
import { hostCheckoutPath, packagedExtensionCatalog } from "../extension-catalog";

export type DiagnosticsSource = { source_kind: string; source_path: string; source_ref: string | null };

const samePath = (left: string, right: string) => {
  try {
    return realpathSync(left) === realpathSync(right);
  } catch {
    return false;
  }
};

/**
 * A `pstdio.` extension from the packaged catalog, installed from that catalog's own source: its
 * Git origin, the host's release registry or this host's source checkout. The manifest id alone
 * proves nothing, because any folder can claim it.
 */
export const isFirstPartySource = (extensionId: string, source: DiagnosticsSource, releaseRegistry?: string) => {
  const id = canonicalExtensionId(extensionId);
  const entry = packagedExtensionCatalog.extensions.find(
    (candidate) => candidate.extensionId && canonicalExtensionId(candidate.extensionId) === id,
  );
  if (!entry || !id.startsWith("pstdio.")) return false;
  if (source.source_kind === "git") {
    const origin = parseExtensionSourceRef(source.source_ref);
    return origin?.url === entry.origin.url && origin.path === entry.origin.path;
  }
  if (source.source_kind === "registry") {
    const release = parseRegistrySourceRef(source.source_ref);
    // The registry client saves sources without a trailing slash; the host's setting may keep one.
    const registry = (value?: string) => value?.replace(/\/$/, "");
    return release !== null && release.id === id && registry(release.registry) === registry(releaseRegistry);
  }
  return source.source_kind === "local_path" && samePath(source.source_path, hostCheckoutPath(entry));
};

/**
 * Profiling exposes host internals such as source paths, call stacks and runtime identifiers, so
 * only first-party extensions installed from their catalog source may capture.
 */
export const createDiagnosticsApi = (
  input: { extensionId: string; source: DiagnosticsSource; releaseRegistry?: string },
  scope?: InvocationScope,
) =>
  ({
    capture: async (request) => {
      if (!isFirstPartySource(input.extensionId, input.source, input.releaseRegistry))
        throw Object.assign(new Error(`${input.extensionId} may not profile the Prompt Studio host.`), {
          code: "diagnostics_forbidden",
        });
      // A capture ends with the invocation that started it, so a stopped worker cannot leave the profiler running.
      const ended = new AbortController();
      scope?.register(() => ended.abort(new Error("The invocation that started the capture ended.")));
      const signals = [ended.signal, scope?.signal, request.signal].filter((signal) => signal !== undefined);
      return captureBackendDiagnostic({ ...request, signal: AbortSignal.any(signals) });
    },
  }) satisfies ExtensionDiagnosticsApi;
