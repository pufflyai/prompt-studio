import { expect, test } from "bun:test";
import { resolveCiScope } from "./pull-request-ci-scope";
import { requireCiJobs, requiredCiJobs } from "./required-ci-jobs";

test("every selected check is required even when GitHub reports it as skipped", () => {
  const scope = resolveCiScope({
    event: "pull_request",
    changedFiles: ["bun.lock"],
    labels: [],
    packageDirs: [],
    affectedPackages: [],
  });
  const required = requiredCiJobs(scope);
  const results = Object.fromEntries(required.map((name) => [name, { result: "success" }]));
  expect(() => requireCiJobs(required, results)).not.toThrow();
  for (const name of required) {
    expect(() => requireCiJobs(required, { ...results, [name]: { result: "skipped" } }), name).toThrow();
  }
});

test("failures cannot hide in an unselected or newly added job", () => {
  expect(() =>
    requireCiJobs(["scope", "static_checks"], {
      scope: { result: "success" },
      static_checks: { result: "success" },
      other: { result: "failure" },
    }),
  ).toThrow();
  expect(() =>
    requireCiJobs(["scope", "static_checks"], {
      scope: { result: "success" },
      static_checks: { result: "success" },
      other: { result: "cancelled" },
    }),
  ).toThrow();
});

test("missing required results fail while intentionally unselected jobs may skip", () => {
  expect(() =>
    requireCiJobs(["scope", "static_checks", "lint"], {
      scope: { result: "success" },
      static_checks: { result: "success" },
    }),
  ).toThrow();
  expect(() =>
    requireCiJobs(["scope", "static_checks"], {
      scope: { result: "success" },
      static_checks: { result: "success" },
      lint: { result: "skipped" },
    }),
  ).not.toThrow();
});

test("the merge queue requires every job main requires", () => {
  const scope = (event: string) =>
    resolveCiScope({ event, changedFiles: ["README.md"], labels: [], packageDirs: [], affectedPackages: [] });
  expect(requiredCiJobs(scope("merge_group"))).toEqual(requiredCiJobs(scope("push")));
  expect(requiredCiJobs(scope("merge_group"))).toContain("packaged_toolchain");
});

test("quarantine setup failures remain blocking", () => {
  const results = {
    scope: { result: "success" },
    static_checks: { result: "success" },
    quarantined_bun_tests: { result: "failure" },
    quarantined_browser_tests: { result: "failure" },
  };
  expect(() => requireCiJobs(["scope", "static_checks"], results)).toThrow();
  expect(() => requireCiJobs(["scope", "static_checks", "quarantined_bun_tests"], results)).toThrow();
});

test("the merge queue requires native client builds", () => {
  const scope = resolveCiScope({
    event: "merge_group",
    changedFiles: ["README.md"],
    labels: [],
    packageDirs: [],
    affectedPackages: [],
  });
  expect(requiredCiJobs(scope)).toContain("build_clients");
});
