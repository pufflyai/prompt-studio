import { expect, test } from "bun:test";
import type { NavigationTarget } from "@pstdio/sdk/extensions";
import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { useSkillSelection } from "./use-skill-selection";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

test("retries automatic selection after navigation fails with unchanged skill data", async () => {
  const skill = { id: "review-id", name: "review", title: "Review", project_id: "project" };
  const calls: NavigationTarget[] = [];
  const navigation = {
    open: async (target: NavigationTarget) => {
      calls.push(target);
      if (calls.length === 1) throw new Error("Navigation unavailable");
    },
  };
  let selection: ReturnType<typeof useSkillSelection>;
  const Selection = () => {
    selection = useSkillSelection(navigation, skill, true);
    return null;
  };
  let renderer: ReactTestRenderer;
  await act(async () => {
    renderer = create(createElement(Selection));
  });
  expect(String(selection!.error)).toContain("Navigation unavailable");
  await act(async () => {
    selection!.retry();
  });
  expect(calls).toHaveLength(2);
  expect(calls[1]).toMatchObject({ kind: "page", resource: { id: "review-id", projectId: "project" } });
  expect(selection!.error).toBeUndefined();
  await act(async () => {
    renderer!.unmount();
  });
});
