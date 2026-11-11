import { test } from "bun:test";
import { CORE_EXTENSIONS_SMOKE_TEST_TIMEOUT, withPackagedCoreExtensions } from "./packaged-core-extensions.fixture";
import { expectGithubResources } from "./packaged-github-resources-smoke";
import { runtimeAuthorization } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";

setupPackagedSmokeTests();
test(
  "GitHub PR resources can be imported, resolved and linked through the shared service",
  async () => {
    await withPackagedCoreExtensions(
      async ({ started, project }) => {
        await expectGithubResources({
          baseUrl: started.baseUrl,
          projectId: project.id,
          headers: runtimeAuthorization(started.descriptor),
        });
      },
      ["github", "pstdio-planner"],
    );
  },
  CORE_EXTENSIONS_SMOKE_TEST_TIMEOUT,
);
