import { expect, test } from "bun:test";
import { MAX_COLLECTION_PAGE_SIZE } from "@pstdio/sdk/extensions";
import { clampCollectionPageSize, defaultCollectionPageSize } from "./renderer-page-size";

test("collection pages stay between one row and the shared maximum", () => {
  expect(defaultCollectionPageSize).toBe(100);
  expect(MAX_COLLECTION_PAGE_SIZE).toBe(500);
  expect(clampCollectionPageSize(0)).toBe(1);
  expect(clampCollectionPageSize(100)).toBe(100);
  expect(clampCollectionPageSize(MAX_COLLECTION_PAGE_SIZE)).toBe(500);
  expect(clampCollectionPageSize(MAX_COLLECTION_PAGE_SIZE + 1)).toBe(500);
  expect(clampCollectionPageSize(500.9)).toBe(500);
  expect(clampCollectionPageSize(99.9)).toBe(99);
});
