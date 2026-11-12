import { expect, test } from "bun:test";
import { publishResourceActivitySchema } from "./resource-activity";

test("comments can contain a file without text, while empty comments and outcomes are rejected", () => {
  expect(
    publishResourceActivitySchema.safeParse({ key: "file", kind: "comment", body: "", attachmentIds: ["file"] })
      .success,
  ).toBe(true);
  expect(publishResourceActivitySchema.safeParse({ key: "empty", kind: "comment", body: " " }).success).toBe(false);
  expect(
    publishResourceActivitySchema.safeParse({ key: "empty-change", kind: "change", body: "", attachmentIds: ["file"] })
      .success,
  ).toBe(false);
});
