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

test("queue and full stages still require native client builds", () => {
  const scope = resolveCiScope({
    event: "merge_group",
    changedFiles: ["README.md"],
    labels: [],
    packageDirs: [],
    affectedPackages: [],
  });
  expect(requiredCiJobs(scope)).toContain("build_clients");
  expect(requiredCiJobs({ ...scope, stage: "full" })).toContain("packaged_toolchain");
});
