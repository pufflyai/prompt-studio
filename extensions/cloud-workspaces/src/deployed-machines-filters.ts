import type { DeployedMachineRow } from "./deployed-machines-commands";
import { machineStates } from "./machine-labels";

export interface DeployedMachineFilters {
  state?: string;
  reason?: string;
  template?: string;
}

export const emptyDeployedMachineFilters: DeployedMachineFilters = {};

const selected = <T extends string>(value: T | undefined) => Boolean(value);

export function filterDeployedMachines(rows: readonly DeployedMachineRow[], filters: DeployedMachineFilters) {
  return rows.filter(
    (row) =>
      (!selected(filters.state) || row.state === filters.state) &&
      (!selected(filters.reason) || row.reason === filters.reason) &&
      (!selected(filters.template) || row.template === filters.template),
  );
}

const unique = (values: readonly string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));

export function deployedMachineFilterOptions(rows: readonly DeployedMachineRow[]) {
  const present = new Set(rows.map(({ state }) => state));
  return {
    states: machineStates.filter(({ value }) => present.has(value as DeployedMachineRow["state"])),
    reasons: unique(rows.map(({ reason }) => reason)),
    templates: unique(rows.map(({ template }) => template)),
  };
}
