import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { type PageRef, serializePageUrl, workbenchPageDefinitions } from "@pstdio/sdk/extensions";

type Page = WorkbenchExtensionMetadata["pages"][number];
export const planSmokePages = (inventory: Page[], extensionId: string, projectId: string) => {
  const needsContext = (page: Page) => {
    const seen = new Set<string>();
    let current: Page | undefined = page;
    while (current) {
      if (current.resource || seen.has(current.id)) return true;
      seen.add(current.id);
      const parent: PageRef | undefined = current.parent;
      if (!parent) return false;
      if (parent.extensionId === "pstdio") {
        const host = Object.values(workbenchPageDefinitions).find((item) => item.ref.id === parent.id);
        return !host || host.primary.resourceKinds.length > 0;
      }
      current = inventory.find((item) => item.extensionId === parent.extensionId && item.localId === parent.id);
    }
    return true;
  };
  const pages: { page: Page; url: string }[] = [];
  const unexercised: { contributionId: string; reason: string }[] = [];
  for (const page of inventory.filter((item) => item.extensionId === extensionId)) {
    if (needsContext(page)) {
      unexercised.push({ contributionId: page.id, reason: "Requires a resource or unavailable parent context." });
      continue;
    }
    const ref: PageRef = { extensionId: page.extensionId, kind: "page", id: page.localId };
    pages.push({ page, url: serializePageUrl({ projectId, page: { id: page.id, ref, path: page.path } }) });
  }
  return { pages, unexercised };
};

export const completeSmokeCoverage = (
  inventory: WorkbenchExtensionMetadata,
  result: import("./smoke-result").SmokeResult,
  selectedPageIds: string[],
) => {
  const extensionId = result.extension!.id;
  const known = new Set([
    ...result.coverage.visited,
    ...result.coverage.unexercised.map((item) => item.contributionId),
    ...selectedPageIds,
  ]);
  for (const [kind, entries] of Object.entries(inventory)) {
    if (!Array.isArray(entries) || kind === "extensions" || kind === "diagnostics") continue;
    const owned = (entries as unknown[]).filter(
      (entry): entry is { id: string; extensionId: string } =>
        typeof entry === "object" &&
        entry !== null &&
        "id" in entry &&
        "extensionId" in entry &&
        entry.extensionId === extensionId,
    );
    result.coverage.counts[kind] = owned.length;
    for (const entry of owned)
      if (!known.has(entry.id)) {
        known.add(entry.id);
        result.coverage.unexercised.push({
          contributionId: entry.id,
          reason:
            kind === "commands"
              ? "Commands are not executed automatically."
              : "Not mounted in the selected initial page compositions; resource, optional, settings and interaction scenarios require explicit tests.",
        });
      }
  }
};
