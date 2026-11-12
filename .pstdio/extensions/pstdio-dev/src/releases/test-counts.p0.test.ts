import { expect, test } from "bun:test";
import { testJobCategory } from "./test-counts";

test("classifies every release test job into one stacked category", () => {
  expect(testJobCategory("production / functional / e2e_P2 (1/12)")).toBe("end-to-end");
  expect(testJobCategory("production / functional / packaged_and_vite_e2e_P1 (browser 1/1)")).toBe("end-to-end");
  expect(testJobCategory("production / functional / components_P1 (ui)")).toBe("components");
  expect(testJobCategory("production / functional / database_tests_P1 (api 1/2)")).toBe("backend");
  expect(testJobCategory("production / functional / bun_contracts_P1 (1/2)")).toBe("backend");
  expect(testJobCategory("production / functional / integration_contracts_P1 (1/2)")).toBe("backend");
  expect(testJobCategory("production / functional / package_checks (1/4)")).toBe("packages");
  expect(testJobCategory("production / functional / packaged_toolchain / verify (cli-linux-x64 1/1)")).toBe("packages");
  expect(testJobCategory("production / functional / harness_cli_support / harness-codex (latest)")).toBe("harness");
  expect(testJobCategory("production / performance")).toBe("performance");
  expect(testJobCategory("production / functional / quarantined_bun_tests (ubuntu-latest)")).toBe("quarantine");
});
