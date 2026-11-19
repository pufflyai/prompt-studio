import type { DefaultExtensionEntry } from "../features/extensions/default-extensions";
import { findExtensionCatalogEntry } from "../features/extensions/extension-catalog";
import { createSharedNamedSourceCheckout } from "../features/extensions/extension-source-checkout";
import { packExtension } from "../features/extensions/publication/package";
import { sourceMatchesPublication } from "../features/extensions/publication/source";
import type { createExtensionService } from "../services/extension-service";
import { parseExtensionSourceRef } from "../services/extension-source-ref";

type InstalledSource = Awaited<ReturnType<ReturnType<typeof createExtensionService>["getInstalledSource"]>>;
const managedSourceBytes = async (commit: string) => {
  const checkout = await createSharedNamedSourceCheckout(["workspaces"], { ref: commit });
  try {
    const source = await checkout.prepareNamedSource("workspaces", "", commit);
    return await packExtension(source.path);
  } finally {
    checkout.cleanup();
  }
};

/** Only bytes identical to the recorded first-party commit may be replaced automatically. */
export const canRefreshWorkspacesTool = async (
  source: InstalledSource,
  readManagedSource: (commit: string) => Promise<Blob> = managedSourceBytes,
) => {
  if (!source || source.extension_id !== "pstdio.workspaces" || source.source_kind !== "git") return false;
  try {
    const origin = parseExtensionSourceRef(source.source_ref);
    const entry = await findExtensionCatalogEntry("workspaces");
    if (!origin || !entry || origin.url !== entry.origin.url || origin.path !== entry.origin.path) return false;
    return await sourceMatchesPublication(source.source_path, await readManagedSource(origin.commit));
  } catch {
    // Offline or unavailable historical bytes are not proof that the user copy may be replaced.
    return false;
  }
};

export const refreshingWorkspacesEntry = (entry: DefaultExtensionEntry): DefaultExtensionEntry =>
  typeof entry === "string" ? { source: entry, installName: "workspaces", force: true } : { ...entry, force: true };
