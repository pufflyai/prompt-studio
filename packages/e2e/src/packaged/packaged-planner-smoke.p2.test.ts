import { test } from "bun:test";
import { expectPackagedPlannerAutoBuild } from "./packaged-planner-auto-build-smoke";
import { withPackagedPlanner } from "./packaged-planner-helpers";
import { expectPackagedPlannerTimeline } from "./packaged-planner-timeline-smoke";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

setupPackagedSmokeTests();

const plannerTestTimeout = process.platform === "darwin" && process.arch === "arm64" ? 45_000 : PACKAGED_TEST_TIMEOUT;

test(
  "packaged Planner keeps independent views, timeline status, milestones, and review requests",
  () => withPackagedPlanner(expectPackagedPlannerTimeline, ["workbench-fixture"]),
  plannerTestTimeout,
);
test(
  "packaged Planner keeps supervisor model choices, scoped Auto Build dispatch, and dependency blockers",
  () => withPackagedPlanner(expectPackagedPlannerAutoBuild),
  process.platform === "win32" ? 45_000 : plannerTestTimeout,
);
