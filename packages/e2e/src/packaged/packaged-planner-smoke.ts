import { test } from "bun:test";
import { expectPackagedPlannerAutoBuild } from "./packaged-planner-auto-build-smoke";
import { withPackagedPlanner } from "./packaged-planner-helpers";
import {
  expectPackagedDependencyStacks,
  expectPackagedDraftAdoption,
  expectPackagedWorkspaceRecovery,
} from "./packaged-planner-stacks-smoke";
import { expectPackagedPlannerTimeline } from "./packaged-planner-timeline-smoke";
import { expectBriefSupervisorWakes } from "./packaged-planner-wakes-smoke";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

export function registerPackagedPlannerSmokeTests() {
  test(
    "packaged Planner keeps independent views, timeline status, milestones, and review requests",
    () => withPackagedPlanner(expectPackagedPlannerTimeline),
    PACKAGED_TEST_TIMEOUT,
  );
  test(
    "packaged Planner keeps supervisor model choices, scoped Auto Build dispatch, and dependency blockers",
    () => withPackagedPlanner(expectPackagedPlannerAutoBuild),
    PACKAGED_TEST_TIMEOUT,
  );
  test(
    "packaged Planner keeps brief supervisor wakes and resume ownership",
    () => withPackagedPlanner(expectBriefSupervisorWakes),
    PACKAGED_TEST_TIMEOUT,
  );
  test(
    "packaged Planner reconciles dependency stacks and Git conflicts",
    () => withPackagedPlanner(expectPackagedDependencyStacks),
    PACKAGED_TEST_TIMEOUT,
  );
  test(
    "packaged Planner recovers missing workspaces without losing submitted work",
    () => withPackagedPlanner(expectPackagedWorkspaceRecovery),
    PACKAGED_TEST_TIMEOUT,
  );
  test(
    "packaged Planner adopts a feature draft without changing its Git state",
    () => withPackagedPlanner(expectPackagedDraftAdoption),
    PACKAGED_TEST_TIMEOUT,
  );
}
