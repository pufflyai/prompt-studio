import { contributionRefId, isWorkbenchProjectUrl, type PageLocation } from "@pstdio/sdk/extensions";
import type {
  ResolvedPageLocation,
  WorkbenchPageBrowserEntry,
  WorkbenchPageHistoryState,
  WorkbenchPageLocationBrowser,
  WorkbenchPageLocationPersistence,
  WorkbenchPageNavigationResult,
} from "./page-location-types";

export const isPageHistoryState = (value: unknown): value is WorkbenchPageHistoryState => {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<WorkbenchPageHistoryState>;
  return (
    state.kind === "pstdio.page-location" &&
    typeof state.index === "number" &&
    typeof state.projectId === "string" &&
    typeof state.routeKey === "string" &&
    Boolean(state.location && typeof state.location === "object")
  );
};

interface PageLocationRestorationInput {
  browser: WorkbenchPageLocationBrowser;
  persistence: WorkbenchPageLocationPersistence;
  restoreHistory(entry: WorkbenchPageBrowserEntry, projectId: string): void;
  resolveUrl(projectId: string, entry: WorkbenchPageBrowserEntry): ResolvedPageLocation | undefined;
  normalizeStored(location: PageLocation): ResolvedPageLocation;
  start(): ResolvedPageLocation;
  restoreRoot(location?: PageLocation): void;
  restoreModes(locations?: Readonly<Record<string, PageLocation>>): void;
  modeTarget(modeId: string): PageLocation;
  commit(
    projectId: string,
    resolved: ResolvedPageLocation,
    history: "replace",
    action: string,
  ): WorkbenchPageNavigationResult;
  fail(source: "boot" | "project-switch", error: unknown): WorkbenchPageNavigationResult;
}

const restoreFallback = (input: PageLocationRestorationInput, projectId: string, source: "boot" | "project-switch") => {
  try {
    const saved = input.persistence.load(projectId)?.location;
    const modeId = saved?.mode ? contributionRefId(saved.mode) : undefined;
    const fallback = modeId ? input.normalizeStored(input.modeTarget(modeId)) : input.start();
    return input.commit(projectId, fallback, "replace", `${source}StartFallback`);
  } catch (error) {
    return input.fail(source, error);
  }
};

export const createPageLocationRestorer =
  (input: PageLocationRestorationInput) =>
  (projectId: string, source: "boot" | "project-switch", useCurrentUrl: boolean) => {
    let explicitUrlMode = false;
    try {
      const browserEntry = input.browser.current();
      const hasProjectUrl = useCurrentUrl && isWorkbenchProjectUrl(browserEntry.url, projectId);
      explicitUrlMode = hasProjectUrl && new URL(browserEntry.url, "http://workbench.local").searchParams.has("mode");
      const fromUrl = hasProjectUrl ? input.resolveUrl(projectId, browserEntry) : undefined;
      if (hasProjectUrl && !fromUrl) throw new Error(`Cannot resolve page URL: ${browserEntry.url}`);
      // A URL wins over the saved page. The saved root level still names the way out of a level.
      const persisted = input.persistence.load(projectId);
      input.restoreRoot(persisted?.rootLevel);
      input.restoreModes(persisted?.modeLocations);
      const saved = hasProjectUrl ? undefined : persisted?.location;
      const resolved = fromUrl ?? (saved ? input.normalizeStored(saved) : input.start());
      input.restoreHistory(browserEntry, projectId);
      return input.commit(projectId, resolved, "replace", source === "boot" ? "bootPageLocation" : "switchPageProject");
    } catch (error) {
      if (explicitUrlMode) return input.fail(source, error);
      input.fail(source, error);
      return restoreFallback(input, projectId, source);
    }
  };
