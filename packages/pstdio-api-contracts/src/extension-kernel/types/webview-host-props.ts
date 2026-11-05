import type { PageLocation, PageParams, ViewLocation } from "./pages";
import type { ResourceRef } from "./resources";

export interface WebviewHostProps {
  projectId?: string;
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
