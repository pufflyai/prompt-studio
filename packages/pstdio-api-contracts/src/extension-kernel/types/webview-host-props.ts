import type { PageLocation, PageParams } from "./pages";
import type { ResourceRef } from "./resources";

export interface WebviewHostProps {
  projectId?: string;
  themePreference: string;
  locale: string;
  resource?: ResourceRef;
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
