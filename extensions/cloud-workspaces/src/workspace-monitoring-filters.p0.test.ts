import { expect, test } from "bun:test";
import { allowedWorkspaceStates, readWorkspaceFilter, workspaceFilterFields } from "./workspace-monitoring-filters";

const fields = workspaceFilterFields("State");

test("restores a multi-state filter and applies the same matching rules as data tables", () => {
  const filter = readWorkspaceFilter(
    JSON.stringify({
      conjunction: "and",
      rules: [{ attributeId: "state", condition: "is-any-of", value: ["failed", "ready"] }],
      groups: [{ conjunction: "or", rules: [{ attributeId: "state", condition: "is-none-of", value: ["failed"] }] }],
    }),
  );
  expect(allowedWorkspaceStates(filter, fields)).toEqual(["ready"]);
});

test("a missing or invalid filter keeps every workspace state eligible", () => {
  expect(allowedWorkspaceStates(readWorkspaceFilter(undefined), fields)).toContain("failed");
  expect(allowedWorkspaceStates(readWorkspaceFilter('{"rules":[null]}'), fields)).toHaveLength(11);
});
