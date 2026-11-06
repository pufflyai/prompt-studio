import { expect, test } from "bun:test";
import { acceptanceConditions } from "./forms";

test("authoring permits no acceptance condition and keeps linked tests with a stated condition", () => {
  expect(acceptanceConditions("", "")).toEqual([]);
  expect(acceptanceConditions("Users can reopen saved work", "feature.p1.test.ts")).toEqual([
    { statement: "Users can reopen saved work", tests: ["feature.p1.test.ts"] },
  ]);
  expect(() => acceptanceConditions("", "feature.p1.test.ts")).toThrow("acceptance condition");
});
