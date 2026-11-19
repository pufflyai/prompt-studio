import { test } from "bun:test";
import { expectPackagedPlannerAutoBuild } from "./packaged-planner-auto-build-smoke";
import { withPackagedPlanner } from "./packaged-planner-helpers";
import { expectPackagedPlannerTimeline } from "./packaged-planner-timeline-smoke";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";

setupPackagedSmokeTests();

// Both journeys exhausted Linux CI's 30 s while commands were still progressing,
// after 15–16 s of cold project setup. PS-1232: user-authorized setup/test allowance.
const plannerTestTimeout = 120_000;

test(
  "packaged Planner keeps independent views, timeline status, milestones, and review requests",
  () => withPackagedPlanner(expectPackagedPlannerTimeline, ["workbench-fixture", "git-workspaces"]),
  plannerTestTimeout,
);
test(
  "packaged Planner keeps supervisor model choices, scoped Auto Build dispatch, and dependency blockers",
  () => withPackagedPlanner(expectPackagedPlannerAutoBuild, ["git-workspaces"]),
  plannerTestTimeout,
);
