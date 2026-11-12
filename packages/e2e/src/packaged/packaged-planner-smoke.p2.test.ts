import { test } from "bun:test";
import { expectPackagedPlannerAutoBuild } from "./packaged-planner-auto-build-smoke";
import { withPackagedPlanner } from "./packaged-planner-helpers";
import {
  expectPackagedDependencyStacks,
  expectPackagedDraftAdoption,
  expectPackagedManualWorkspaceRecovery,
  expectPackagedWorkspaceRecovery,
} from "./packaged-planner-stacks-smoke";
import { expectPackagedPlannerTimeline } from "./packaged-planner-timeline-smoke";
import { expectBriefSupervisorWakes } from "./packaged-planner-wakes-smoke";
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
test(
  "packaged Planner keeps brief supervisor wakes and resume ownership",
  () => withPackagedPlanner(expectBriefSupervisorWakes, ["workbench-fixture"]),
  plannerTestTimeout,
);
test(
  "packaged Planner reconciles dependency stacks and Git conflicts",
  () => withPackagedPlanner(expectPackagedDependencyStacks, ["workbench-fixture"]),
  plannerTestTimeout,
);
test(
  "packaged Planner recovers missing workspaces without losing submitted work",
  () => withPackagedPlanner(expectPackagedWorkspaceRecovery, ["workbench-fixture"]),
  plannerTestTimeout,
);
test(
  "packaged Planner adopts a feature draft without changing its Git state",
  () => withPackagedPlanner(expectPackagedDraftAdoption, ["workbench-fixture"]),
  plannerTestTimeout,
);

test(
  "packaged Planner manually resumes missing stopped work with Auto Build disabled",
  () => withPackagedPlanner(expectPackagedManualWorkspaceRecovery, ["workbench-fixture"]),
  plannerTestTimeout,
);
