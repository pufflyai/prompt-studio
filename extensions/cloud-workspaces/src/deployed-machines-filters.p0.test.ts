import { expect, test } from "bun:test";
import type { DeployedMachineRow } from "./deployed-machines-commands";
import { deployedMachineFilterOptions, filterDeployedMachines } from "./deployed-machines-filters";

const row = (overrides: Partial<DeployedMachineRow>): DeployedMachineRow => ({
  id: crypto.randomUUID(),
  name: "workspace",
  state: "ready",
  status: "Ready",
  reason: "",
  template: "remote-tests",
  version: "1.0.0",
  createdAt: "2026-11-22T00:00:00Z",
  canStop: true,
  resource: { type: "deployed-machine", id: crypto.randomUUID() },
  ...overrides,
});

test("filters deployed machines by one selected state, reason and template", () => {
  const rows = [
    row({ state: "ready", template: "remote-tests" }),
    row({ state: "failed", reason: "canceled_by_caller", template: "prompt-studio-preview" }),
    row({ state: "canceled", reason: "canceled_by_caller", template: "remote-tests" }),
  ];
  expect(filterDeployedMachines(rows, {})).toHaveLength(3);
  expect(filterDeployedMachines(rows, { state: "failed" })).toEqual([rows[1]!]);
  expect(filterDeployedMachines(rows, { reason: "canceled_by_caller" })).toEqual([rows[1]!, rows[2]!]);
  expect(filterDeployedMachines(rows, { template: "remote-tests" })).toEqual([rows[0]!, rows[2]!]);
  expect(
    filterDeployedMachines(rows, { state: "canceled", reason: "canceled_by_caller", template: "remote-tests" }),
  ).toEqual([rows[2]!]);
});

test("offers only present states, reasons and templates", () => {
  const options = deployedMachineFilterOptions([
    row({ state: "ready", template: "remote-tests" }),
    row({ state: "failed", reason: "canceled_by_caller", template: "prompt-studio-preview" }),
  ]);
  expect(options.states.map(({ value }) => value)).toEqual(["ready", "failed"]);
  expect(options.reasons).toEqual(["canceled_by_caller"]);
  expect(options.templates).toEqual(["prompt-studio-preview", "remote-tests"]);
});
