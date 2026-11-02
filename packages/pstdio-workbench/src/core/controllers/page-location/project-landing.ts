import { type PageRef, workbenchPages } from "@pstdio/sdk/extensions";
import type { WorkbenchPageContribution } from "../../registries/pages/page-registry";
import { normalizeWorkbenchPageLocation } from "./page-location-normalization";

export const resolveProjectLandingPage = (pages: readonly WorkbenchPageContribution[], fallback: PageRef) => {
  if (fallback.extensionId !== "pstdio" || fallback.id !== workbenchPages.start.id) return fallback;
  const roots = pages
    .filter((page) => page.modeId === "project" && !page.parentId && !page.resource)
    .sort((a, b) => a.id.localeCompare(b.id));
  // Contribution IDs give multiple providers a stable order, independent of activation timing.
  return (
    roots.find((page) => page.projectLanding)?.ref ??
    pages.find((page) => page.ref.extensionId === fallback.extensionId && page.ref.id === fallback.id)?.ref ??
    roots[0]?.ref ??
    fallback
  );
};

export const resolveProjectLandingTarget = <T extends { page: PageRef; parent?: T }>(
  pages: readonly WorkbenchPageContribution[],
  target: T,
) => {
  const chain: T[] = [];
  const visited = new Set<T>();
  for (let current: T | undefined = target; current; current = current.parent) {
    if (visited.has(current)) throw new Error("Page parent cycle");
    visited.add(current);
    chain.push(current);
  }
  let parent: T | undefined;
  for (const current of chain.reverse()) {
    parent = { ...current, page: resolveProjectLandingPage(pages, current.page), parent };
  }
  return parent!;
};

export const normalizeProjectPageLocation = (input: Parameters<typeof normalizeWorkbenchPageLocation>[0]) =>
  normalizeWorkbenchPageLocation({ ...input, location: resolveProjectLandingTarget(input.pages, input.location) });
