import type { LinkIcon } from "pstdio-api-contracts";
import type { RequestFn } from "./request";

export type LinkIconsClient = {
  /** Returns the site icon of an http or https page. Throws a 404 `PstdioApiError` when the page has none. */
  get(url: string, options?: { signal?: AbortSignal }): Promise<LinkIcon>;
};

export const createLinkIconsClient = (request: RequestFn): LinkIconsClient => ({
  get: (url, options) => request(`/v1/link-icons?url=${encodeURIComponent(url)}`, options),
});
