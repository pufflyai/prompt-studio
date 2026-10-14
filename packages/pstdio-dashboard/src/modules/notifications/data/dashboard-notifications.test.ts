import { expect, test } from "bun:test";
import { resourceKey } from "@pstdio/sdk/extensions";
import { toWorkbenchResource } from "./dashboard-notifications";

test("session notifications keep the target project's resource identity", () => {
  const target = { type: "session", id: "session-1", extensionId: "pstdio", projectId: "target-project" };
  expect(resourceKey(toWorkbenchResource(target, "selected-project"))).toBe(resourceKey(target));
});
