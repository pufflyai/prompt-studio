import { describe, expect, test } from "bun:test";
import { toWorkbenchContributionId } from "./contribution-ref";

describe("toWorkbenchContributionId", () => {
  test("keeps host ids and qualifies extension ids with their declared kind", () => {
    expect(toWorkbenchContributionId({ extensionId: "pstdio", kind: "command", id: "workbench.open" })).toBe(
      "workbench.open",
    );
    expect(toWorkbenchContributionId({ extensionId: "acme.recipes", kind: "mode", id: "cook" })).toBe(
      "acme.recipes.mode.cook",
    );
    expect(toWorkbenchContributionId({ extensionId: "acme.recipes", kind: "view", id: "details" })).toBe(
      "acme.recipes.view.details",
    );
  });
});
