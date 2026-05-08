import { describe, expect, test } from "bun:test";
import { shouldCancelLinkEdit } from "./link-edit-state";

describe("shouldCancelLinkEdit", () => {
  test("cancels editing when the selection no longer has a link", () => {
    expect(shouldCancelLinkEdit(true, true, "")).toBe(true);
  });

  test("keeps editing when the selection still has a link", () => {
    expect(shouldCancelLinkEdit(true, true, "https://example.com")).toBe(false);
  });

  test("does not cancel when edit mode is already inactive", () => {
    expect(shouldCancelLinkEdit(false, true, "")).toBe(false);
  });

  test("keeps editing when inserting a new link", () => {
    expect(shouldCancelLinkEdit(true, false, "")).toBe(false);
  });
});
