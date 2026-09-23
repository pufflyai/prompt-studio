import { describe, expect, test } from "bun:test";
import { navigationTargetSchema } from "../extensions/navigation-target-metadata";
import { isNavigationTarget, qualifyNavigationTarget } from "./navigation";

describe("external navigation targets", () => {
  test.each([
    "https://example.com/path?q=1#section",
    "http://localhost:3000/",
    "HTTPS://example.com/",
  ])("accepts web URL %s", (href) => {
    const target = { kind: "href" as const, href };
    expect(isNavigationTarget(target)).toBe(true);
    expect(navigationTargetSchema.safeParse(target).success).toBe(true);
    expect(qualifyNavigationTarget(target, "notes")).toEqual(target);
  });

  test.each([
    "javascript:alert(1)",
    " \tJaVaScRiPt:alert(1)",
    "java\nscript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "blob:https://example.com/id",
    "https://",
    "/relative",
    "//example.com/",
    "",
  ])("rejects unsafe or incomplete URL %s", (href) => {
    const target = { kind: "href" as const, href };
    expect(isNavigationTarget(target)).toBe(false);
    expect(navigationTargetSchema.safeParse(target).success).toBe(false);
    expect(() => qualifyNavigationTarget(target, "notes")).toThrow("Invalid navigation target");
  });
});
