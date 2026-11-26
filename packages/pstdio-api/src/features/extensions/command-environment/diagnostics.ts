import { resolve } from "node:path";
import { canonicalExtensionId } from "pstdio-api-contracts/extension-host";
import type { ExtensionDiagnosticsApi } from "pstdio-api-contracts/extension-kernel";
import { prepareBackendDiagnosticCapture } from "pstdio-diagnostics";
import { type InvocationScope, readAcceptedRevision } from "pstdio-extensions";
import { parseRegistrySourceRef } from "pstdio-extensions/distribution";
import { parseExtensionSourceRef } from "../../../services/extension-source-ref";
import { hostCheckoutPath } from "../extension-catalog";
import { firstPartyCatalogEntry, sameSourcePath } from "../verified-install-origin";

export type DiagnosticsSource = { sourcePath: string; revisionId?: string };

/** Trust the host checkout or a verified install of the revision providing the current handlers. */
export const isFirstPartySource = async (extensionId: string, source?: DiagnosticsSource, releaseRegistry?: string) => {
  const entry = firstPartyCatalogEntry(extensionId);
  if (!entry || !source) return false;
  if (sameSourcePath(source.sourcePath, hostCheckoutPath(entry))) return true;
  if (!source.revisionId) return false;
  const revision = await readAcceptedRevision(source.sourcePath);
  if (revision?.id !== source.revisionId || canonicalExtensionId(revision.manifest.id) !== entry.extensionId)
    return false;
  const install = revision.verifiedInstall;
  if (!install || install.sourcePath !== resolve(source.sourcePath)) return false;
  if (install.ref === null) return true;
  const release = parseRegistrySourceRef(install.ref);
  if (release) {
    // The registry client saves sources without a trailing slash; the host's setting may keep one.
    const registry = (value?: string) => value?.replace(/\/$/, "");
    return release.id === entry.extensionId && registry(release.registry) === registry(releaseRegistry);
  }
  const git = parseExtensionSourceRef(install.ref);
  return git?.url === entry.origin.url && git.path === entry.origin.path;
};

/**
 * Profiling exposes host internals such as source paths, call stacks and runtime identifiers, so
 * only first-party extensions installed from their catalog source may capture.
 */
export const createDiagnosticsApi = (
  input: { extensionId: string; source?: DiagnosticsSource; releaseRegistry?: string },
  scope?: InvocationScope,
) => {
  const active = new Set<Promise<unknown>>();
  let ended: AbortController | undefined;
  const invocationSignal = () => {
    if (!scope) return;
    if (!ended) {
      const lifetime = new AbortController();
      ended = lifetime;
      scope.register(async () => {
        lifetime.abort(new Error("The invocation that started the capture ended."));
        await Promise.allSettled(active);
      });
    }
    return ended.signal;
  };
  return {
    capture: async (request) => {
      if (!(await isFirstPartySource(input.extensionId, input.source, input.releaseRegistry)))
        throw Object.assign(new Error(`${input.extensionId} may not profile the Prompt Studio host.`), {
          code: "diagnostics_forbidden",
        });
      const capture = prepareBackendDiagnosticCapture(request);
      const signals = [scope?.signal, capture.signal, invocationSignal()].filter((signal) => signal !== undefined);
      const recording = capture.run(AbortSignal.any(signals));
      active.add(recording);
      try {
        return await recording;
      } finally {
        active.delete(recording);
      }
    },
  } satisfies ExtensionDiagnosticsApi;
};
