import { expect, test } from "bun:test";
import { resolveIconComponent } from "@pstdio/ui";

test("resolves the Cloud sign-in icon through the shared UI package", () => {
  expect(resolveIconComponent("user-round-key")).toBeDefined();
});
