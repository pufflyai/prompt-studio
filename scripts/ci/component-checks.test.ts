import { expect, test } from "bun:test";
import {
  allComponentChecks,
  componentShardCount,
  selectComponentChecks,
  sharedComponentEssentials,
} from "./component-checks";

test("shared inputs select seven interaction cases without unrelated component permutations", () => {
  const selected = selectComponentChecks(["bun.lock", "packages/ui/src/theme/theme.ts"]);
  expect(selected.files).toEqual(sharedComponentEssentials.map((file) => `src/ui/${file}`).sort());
  expect(componentShardCount(selected.files)).toBe(1);
  expect(selected.reasons.join(" ")).toContain("shared");
});

test("changed owners retain the complete related interaction family", () => {
  const selected = selectComponentChecks(["packages/ui/src/components/data-table/data-table.tsx"]);
  expect(selected.files).toEqual(["src/ui/data-table-editing.spec.ts", "src/ui/data-table-search.spec.ts"]);
  expect(selectComponentChecks(["packages/pstdio-workbench/src/react/region/region-tab-actions.tsx"]).files).toEqual([
    "src/ui/panel-tabs.spec.ts",
    "src/ui/session-resource-actions.spec.ts",
  ]);
});

test("direct spec edits remain selected beside shared-input essentials", () => {
  expect(
    selectComponentChecks(["bun.lock", "packages/storybook-tests/src/ui/panel-placement.spec.ts"]).files,
  ).toContain("src/ui/panel-placement.spec.ts");
});

test("unknown runtime owners receive visible owner essentials without extension manifest noise", () => {
  const selected = selectComponentChecks(["packages/ui/src/components/new-control/new-control.tsx"]);
  expect(selected.files).toEqual(["src/ui/menu-dialog.spec.ts"]);
  expect(selected.reasons.join(" ")).toContain("owner fallback");
  expect(
    selectComponentChecks(["extensions/pstdio-planner/package.json", "extensions/pstdio-artifacts/bun.lock"]).files,
  ).toEqual([]);
  expect(selectComponentChecks(["extensions/pstdio-artifacts/src/components/html-preview.tsx"]).files).toEqual([
    "src/ui/artifacts.spec.ts",
    "src/ui/html-preview.spec.ts",
  ]);
});

test("complete component work retains every discovered spec and three shards", () => {
  expect(componentShardCount(allComponentChecks)).toBe(3);
});
