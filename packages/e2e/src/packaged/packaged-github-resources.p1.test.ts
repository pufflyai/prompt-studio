import { test } from "bun:test";
import { expectGithubResources } from "./packaged-github-resources-smoke";
import { withPackagedPlanner } from "./packaged-planner-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

setupPackagedSmokeTests();
test(
  "GitHub PR resources can be imported, resolved and linked through the shared service",
  async () => {
    await withPackagedPlanner(expectGithubResources, ["github"]);
  },
  PACKAGED_TEST_TIMEOUT,
);
