import { DEFAULT_COLLECTION_PAGE_SIZE, MAX_COLLECTION_PAGE_SIZE } from "@pstdio/sdk/extensions";

/** Keeps a requested provider page within the range every paged table and board supports. */
export const clampCollectionPageSize = (size: number) =>
  Math.max(1, Math.min(MAX_COLLECTION_PAGE_SIZE, Math.trunc(size)));

/** Page size used when a contribution does not declare one. */
export const defaultCollectionPageSize = DEFAULT_COLLECTION_PAGE_SIZE;
