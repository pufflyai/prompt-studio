import { type PageRef, workbenchPages } from "@pstdio/sdk/extensions";
import type { WorkbenchPageContribution } from "../../registries/pages/page-registry";
import type { WorkbenchPageResourceCodec } from "../../registries/pages/page-registry-types";
import { normalizeWorkbenchPageTarget } from "./page-location-normalization";

// Public Start navigation names the application's explicit default if no legacy Start page exists.
// Registered pages retain their usual ownership, paths and activation lifecycle.
export const createStartPageCompatibility = (
  listPages: () => WorkbenchPageContribution[],
  startPage: PageRef,
  resources: WorkbenchPageResourceCodec,
) => {
  const hasStartPage = () =>
    listPages().some(
      (page) => page.ref.extensionId === workbenchPages.start.extensionId && page.ref.id === workbenchPages.start.id,
    );
  const pages = () => {
    const registered = listPages();
    if (hasStartPage() || registered.some((page) => page.id === workbenchPages.start.id)) return registered;
    const start = registered.find(
      (page) => page.ref.extensionId === startPage.extensionId && page.ref.id === startPage.id,
    );
    // Public parent refs use the same explicit default as public Start navigation.
    return start
      ? registered.map((page) => (page.parentId === workbenchPages.start.id ? { ...page, parentId: start.id } : page))
      : registered;
  };
  // Keep public Start targets working when the application supplies another default page.
  // An explicitly registered Start page remains a normal destination for embedded workbenches.
  const withStartPage = <T extends { page: PageRef; parent?: T }>(target: T): T => {
    if (hasStartPage()) return target;
    const chain: T[] = [];
    const seen = new Set<T>();
    for (let current: T | undefined = target; current; current = current.parent) {
      if (seen.has(current)) throw new Error("Page parent cycle");
      seen.add(current);
      chain.push(current);
    }
    let parent: T | undefined;
    for (const current of chain.reverse()) {
      const legacy =
        current.page.extensionId === workbenchPages.start.extensionId && current.page.id === workbenchPages.start.id;
      parent = { ...current, page: legacy ? startPage : current.page, parent };
    }
    return parent!;
  };

  return {
    pages,
    target: withStartPage,
    start: () => normalizeWorkbenchPageTarget({ target: { kind: "page", page: startPage }, pages: pages(), resources }),
  };
};
