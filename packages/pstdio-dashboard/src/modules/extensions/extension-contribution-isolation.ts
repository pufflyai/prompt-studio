import type { Disposable } from "@pstdio/workbench";
import type { ResolvedWorkbenchExtensionMetadata } from "@/shared/extensions/extension-localization";

type ExtensionContributionList = readonly { extensionId?: string }[];

// Leaves out the contributions of the given extensions. Diagnostics stay: they describe every extension.
export const omitExtensionMetadata = (
  metadata: ResolvedWorkbenchExtensionMetadata,
  extensionIds: ReadonlySet<string>,
) =>
  Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => {
      if (key === "extensions")
        return [key, metadata.extensions.filter((extension) => !extensionIds.has(extension.id))];
      if (key === "diagnostics" || !Array.isArray(value)) return [key, value];
      return [
        key,
        (value as ExtensionContributionList).filter((item) => !item.extensionId || !extensionIds.has(item.extensionId)),
      ];
    }),
  ) as ResolvedWorkbenchExtensionMetadata;

interface RegisterHealthyExtensionsInput {
  metadata: ResolvedWorkbenchExtensionMetadata;
  /** Registers the given contributions as one set; throws when any of them cannot register. */
  register: (metadata: ResolvedWorkbenchExtensionMetadata) => Disposable;
  onFailure: (extensionId: string, error: unknown) => void;
}

// One bad extension must not remove the others. The whole set registers together, because
// extensions refer to each other (menus, page parents, placements in another extension's mode).
// When the set fails, extensions join one at a time; an extension that refers to a later one
// gets another try once that one has joined. Only the healthy set stays registered.
export const registerHealthyExtensions = (input: RegisterHealthyExtensionsInput) => {
  const allExtensionIds = input.metadata.extensions.map((extension) => extension.id);
  const tryRegister = (extensionIds: readonly string[]) => {
    const omitted = allExtensionIds.filter((extensionId) => !extensionIds.includes(extensionId));
    const metadata = omitExtensionMetadata(input.metadata, new Set(omitted));
    try {
      return { disposable: input.register(metadata), metadata };
    } catch (error) {
      return { error };
    }
  };

  const complete = tryRegister(allExtensionIds);
  if (!("error" in complete)) return complete;

  // Try removing one failing owner before testing extensions separately. A healthy set may
  // contain mutual references, so its members cannot always register on their own.
  for (const extensionId of allExtensionIds) {
    const trial = tryRegister(allExtensionIds.filter((id) => id !== extensionId));
    if ("error" in trial) continue;
    input.onFailure(extensionId, complete.error);
    return trial;
  }

  const accepted: string[] = [];
  const failures = new Map<string, unknown>();
  let remaining = allExtensionIds;
  for (let joined = true; joined; ) {
    joined = false;
    for (const extensionId of remaining) {
      const trial = tryRegister([...accepted, extensionId]);
      if ("error" in trial) {
        failures.set(extensionId, trial.error);
        continue;
      }
      trial.disposable.dispose();
      accepted.push(extensionId);
      failures.delete(extensionId);
      joined = true;
    }
    remaining = remaining.filter((extensionId) => !accepted.includes(extensionId));
  }
  for (const [extensionId, error] of failures) input.onFailure(extensionId, error);

  const healthy = tryRegister(accepted);
  if ("error" in healthy) throw healthy.error;
  return healthy;
};
