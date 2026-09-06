import type { PageLocation } from "@pstdio/sdk/extensions";
import { workbenchPageLocationKey } from "../../controllers/page-location/page-location-normalization";
import type { WorkbenchPageContribution, WorkbenchPageResourceCodec } from "./page-registry-types";

export const pageStateKey = (
  page: WorkbenchPageContribution,
  location: PageLocation | undefined,
  resources: WorkbenchPageResourceCodec,
) =>
  page.main.kind === "panels" && location ? `${page.id}|${workbenchPageLocationKey(location, resources)}` : page.id;

export const removePageStates = <State>(states: Readonly<Record<string, State>>, pageId: string) =>
  Object.fromEntries(Object.entries(states).filter(([key]) => key !== pageId && !key.startsWith(`${pageId}|`)));
