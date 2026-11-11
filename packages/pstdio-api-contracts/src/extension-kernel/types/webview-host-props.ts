import type { PageLocation, PageParams, ViewLocation } from "./pages";
import type { ResourceRef } from "./resources";
import type { WebviewCommandQuerySeed } from "./webview-command-query";

export interface WebviewHostProps {
  projectId?: string;
  /** Cache authorization boundary; no credentials are exposed. */
  queryScope?: { runtimeId: string; accountId?: string; accountOrigin?: string };
  /** Accepted finite-query values for this authorized source; never values from another frame owner. */
  commandQueries?: { owner: string; values: readonly WebviewCommandQuerySeed[] };
  /** Present only when this view is hosted in a modal dialog. */
  presentation?: "dialog";
  themePreference: string;
  locale: string;
  resource?: ResourceRef;
  viewLocation?: ViewLocation;
  pageLocation?: PageLocation;
  pageParams: PageParams;
  translations: {
    locale: string;
    defaultLocale: string;
    bundle: Record<string, string>;
    defaultBundle: Record<string, string>;
  };
  /** @deprecated Subscribe through client.events or useCommandQuery.refreshOn. */
  lastCommand?: unknown;
}
