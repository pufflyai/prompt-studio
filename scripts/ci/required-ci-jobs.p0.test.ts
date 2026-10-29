import { expect, test } from "bun:test";
import { scopeFixture } from "./ci-scope.test-fixture";
import { resolveCiScope } from "./pull-request-ci-scope";
import { plannedCiJobs, requiredCiJobs } from "./required-ci-jobs";
import { evaluateCiGate } from "./test-policy";

test("required matrix identities come from discovered priority rows", () => {
  const scope = resolveCiScope({ ...scopeFixture(), event: "merge_group" });
  const plan = plannedCiJobs(scope);
  expect(plan.find((job) => job.id === "database_tests_P0")?.priority).toBe("P0");
  expect(plan.find((job) => job.id === "database_tests_P1")?.priority).toBe("P1");
  expect(plan.find((job) => job.id === "storybooks_P1")?.count).toBe(scope.componentMatrix.length);
  expect(plan.find((job) => job.id === "e2e_P1")?.count).toBe(scope.appMatrix.length);
  const observed = plan.flatMap((job) =>
    job.names!.map((name) => ({ name, status: "completed", conclusion: "success" })),
  );
  expect(evaluateCiGate(plan, observed, false, true).outcome).toBe("success");
  const missing = observed.filter((job) => job.name !== plan.find((job) => job.id === "e2e_P1")!.names![0]);
  expect(evaluateCiGate(plan, missing, false, true).outcome).toBe("failure");
});

test("production requires breadth while main requires provenance and smoke", () => {
  const production = resolveCiScope({ ...scopeFixture(), event: "workflow_dispatch", profile: "production" });
  expect(requiredCiJobs(production)).toContain("e2e_P2");
  expect(requiredCiJobs(production)).toContain("windows_database_tests");
  const main = resolveCiScope({ ...scopeFixture(), event: "push" });
  expect(requiredCiJobs(main)).toEqual(["scope", "static_checks", "browser_smoke"]);
});

test("queue native owners provide delivered integrity while production requires every native toolchain shard", () => {
  const input = scopeFixture();
  const queue = plannedCiJobs(resolveCiScope({ ...input, event: "merge_group" }));
  const delivered = queue.find((job) => job.id === "build_clients")!;
  expect(delivered.names).toEqual(["build_clients (linux-x64)", "build_clients (darwin-arm64)"]);
  const completed = queue
    .filter((job) => job.id !== "packaged_toolchain")
    .flatMap((job) => job.names!.map((name) => ({ name, status: "completed", conclusion: "success" })));
  expect(evaluateCiGate(queue, completed, false, true).outcome).toBe("success");
  expect(
    evaluateCiGate(
      queue,
      completed.filter((job) => job.name !== "build_clients (darwin-arm64)"),
      false,
      true,
    ).outcome,
  ).toBe("failure");
  const production = plannedCiJobs(resolveCiScope({ ...input, event: "workflow_dispatch", profile: "production" }));
  expect(production.find((job) => job.id === "packaged_toolchain")?.count).toBe(7);
});

test("production cannot pass without native UI quarantine execution", () => {
  const scope = resolveCiScope({ ...scopeFixture(), event: "workflow_dispatch", profile: "production" });
  const plan = plannedCiJobs(scope);
  expect(plan.find((job) => job.id === "quarantined_native_ui_tests")?.priority).toBe("P2");
  const observed = plan.flatMap((job) =>
    job.names!.map((name) => ({ name, status: "completed", conclusion: "success" })),
  );
  expect(evaluateCiGate(plan, observed, false, true).outcome).toBe("success");
  expect(
    evaluateCiGate(
      plan,
      observed.filter((job) => job.name !== "quarantined_native_ui_tests"),
      false,
      true,
    ).outcome,
  ).toBe("failure");
});

test("production requires both Windows ARM packaged runtime shards", () => {
  const scope = resolveCiScope({ ...scopeFixture(), event: "workflow_dispatch", profile: "production" });
  const plan = plannedCiJobs(scope);
  const names = plan.find((job) => job.id === "packaged_toolchain")!.names!;
  expect(names).toContain("packaged_toolchain / verify (cli-win-arm64 1/2)");
  expect(names).toContain("packaged_toolchain / verify (cli-win-arm64 2/2)");
  const observed = plan.flatMap((job) =>
    job.names!.map((name) => ({ name, status: "completed", conclusion: "success" })),
  );
  expect(evaluateCiGate(plan, observed, false, true).outcome).toBe("success");
  expect(
    evaluateCiGate(
      plan,
      observed.filter((job) => job.name !== "packaged_toolchain / verify (cli-win-arm64 2/2)"),
      false,
      true,
    ).outcome,
  ).toBe("failure");
});

test("production accepts every supported harness version and requires the Windows Pi lanes", () => {
  const scope = resolveCiScope({ ...scopeFixture(), event: "workflow_dispatch", profile: "production" });
  const plan = plannedCiJobs(scope);
  const harnesses = ["harness-codex", "harness-claude-code", "harness-open-code", "harness-pi", "harness-pi, Windows"];
  const observed = plan
    .filter((job) => job.id !== "harness_cli_support")
    .flatMap((job) => job.names!.map((name) => ({ name, status: "completed", conclusion: "success" })));
  for (const harness of harnesses) {
    const [name, os] = harness.split(", ");
    for (const version of ["minimum", "latest"]) {
      observed.push({
        name: `harness_cli_support / ${name} (${version}${os ? `, ${os}` : ""})`,
        status: "completed",
        conclusion: "success",
      });
    }
  }
  expect(evaluateCiGate(plan, observed, false, true)).toMatchObject({ outcome: "success", failures: [] });
  expect(
    evaluateCiGate(
      plan,
      observed.filter((job) => !job.name.includes("minimum, Windows")),
      false,
      true,
    ).outcome,
  ).toBe("failure");
});
