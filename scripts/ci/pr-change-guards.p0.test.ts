import { expect, test } from "bun:test";
import { checkPullRequestChanges, LARGE_CHANGE_LABEL } from "./pr-change-guards";

const change = (path: string, added = 1) => ({ path, added });

test("rejects generated files that are not an allowed exception", () => {
  const problems = checkPullRequestChanges({
    changes: [
      change("extensions/canvas/src/catalog/generated/frame-manifest.json"),
      change("packages/ui/dist/index.js"),
      change("packages/ui/storybook-static/index.html"),
      change("packages/ui/src/button.tsx"),
    ],
    labels: [],
  });

  expect(problems.map((problem) => ("path" in problem ? problem.path : problem.rule))).toEqual([
    "extensions/canvas/src/catalog/generated/frame-manifest.json",
    "packages/ui/dist/index.js",
    "packages/ui/storybook-static/index.html",
  ]);
});

test("allows the listed exceptions", () => {
  const problems = checkPullRequestChanges({
    changes: [
      change("packages/pstdio-extensions/src/bridge/webview-runtime/runtime.bundle.js"),
      change("bun.lock"),
      change("extensions/notes/bun.lock"),
      change("packages/pstdio-db/drizzle/0003_new.sql"),
      change("extensions/harness-codex/src/protocol/v2/Item.ts"),
    ],
    labels: [],
  });

  expect(problems).toEqual([]);
});

test("needs a person's approval label for 2,000 or more added lines", () => {
  const large = [change("packages/ui/src/a.tsx", 1_500), change("bun.lock", 500)];

  expect(checkPullRequestChanges({ changes: large, labels: [] })).toEqual([{ rule: "large-change", added: 2_000 }]);
  expect(checkPullRequestChanges({ changes: large, labels: [LARGE_CHANGE_LABEL] })).toEqual([]);
  expect(checkPullRequestChanges({ changes: [change("packages/ui/src/a.tsx", 1_999)], labels: [] })).toEqual([]);
});
