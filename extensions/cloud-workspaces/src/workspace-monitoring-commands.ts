import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { deployedName, getDeployed } from "./deployed-controller";
import { projectDeployedMachineResource } from "./deployed-machine-resource";
import { machineStateLabel, machineStates } from "./machine-status";
import { type ControllerMachine, isTerminal, machinePath } from "./machines";
import type { WorkspaceActivity } from "./workspace-history";
import { historyRanges } from "./workspace-history-range";
import {
  estimateUsage,
  monitoringActivity,
  parseDefaultRate,
  parseRates,
  workspaceUsage,
} from "./workspace-monitoring-data";
import { monitoringRange, monitoringWindow } from "./workspace-monitoring-range";

const rangeParam = params.select({
  label: l10n("cloud-workspaces.time-range", "Time range"),
  options: [...historyRanges],
});

function projectUsage(
  machine: ControllerMachine,
  range: unknown,
  to: number,
  rates: ReadonlyMap<string, number>,
  defaultRate?: number,
) {
  const hourlyUsd = rates.get(machine.template.name) ?? defaultRate;
  const duration = workspaceUsage(
    machine.ready_at,
    machine.terminal_at,
    monitoringWindow(range, to),
    isTerminal(machine),
  );
  return {
    name: machine.external_id,
    state: machine.state,
    status: machineStateLabel(machine.state),
    template: machine.template.name,
    version: machine.template.version,
    createdAt: machine.created_at,
    readyAt: machine.ready_at,
    terminalAt: machine.terminal_at,
    hourlyUsd: hourlyUsd ?? null,
    ...estimateUsage(duration, hourlyUsd),
  };
}

const summary = defineCommand({
  id: "deployed.monitoring-summary",
  title: l10n("cloud-workspaces.monitoring-summary-command", "Read deployed workspace monitoring"),
  cli: true,
  params: { range: rangeParam },
  async run(ctx, input) {
    const range = monitoringRange(input.range);
    const [settings, activity] = await Promise.all([
      ctx.settings.all(),
      getDeployed<WorkspaceActivity>(ctx.connections, `/v1/workspaces/activity?range=${range}`, ctx.signal),
    ]);
    const bounds = monitoringWindow(range, activity.points.at(-1)?.time);
    const { running, peak, points } = activity;
    return {
      name: deployedName(settings),
      running,
      peak,
      points,
      ...bounds,
      ...monitoringActivity(
        activity,
        parseRates(settings.monitoringHourlyUsd),
        bounds,
        range === "week" ? 7 : 6,
        parseDefaultRate(settings.monitoringDefaultHourlyUsd),
      ),
    };
  },
});

interface WorkspacePage {
  items: ControllerMachine[];
  next_cursor: string | null;
}

const list = defineCommand({
  id: "deployed.monitoring-workspaces",
  title: l10n("cloud-workspaces.monitoring-list-command", "List monitored workspaces"),
  cli: true,
  params: {
    range: rangeParam,
    state: params.select({ label: l10n("cloud-workspaces.state", "State"), options: machineStates }),
    name: params.text({ label: l10n("cloud-workspaces.monitoring-name", "Exact workspace name") }),
    cursor: params.text({ label: l10n("cloud-workspaces.monitoring-cursor", "Next page cursor") }),
    asOf: params.number({
      label: l10n("cloud-workspaces.monitoring-observed-at", "Observation time (Unix milliseconds)"),
    }),
  },
  async run(ctx, input) {
    const query = new URLSearchParams({ limit: "25" });
    const name = input.name?.trim();
    if (name) query.set("external_id", name);
    if (input.state) query.set("state", input.state);
    if (input.cursor) query.set("cursor", input.cursor);

    const [settings, page] = await Promise.all([
      ctx.settings.all(),
      getDeployed<WorkspacePage>(ctx.connections, `/v1/workspaces?${query}`, ctx.signal),
    ]);
    const rates = parseRates(settings.monitoringHourlyUsd);
    const defaultRate = parseDefaultRate(settings.monitoringDefaultHourlyUsd);
    const to = input.asOf ?? Date.now();
    return {
      rows: page.items.map((machine) => ({
        resource: projectDeployedMachineResource(ctx, machine),
        ...projectUsage(machine, input.range, to, rates, defaultRate),
      })),
      nextCursor: page.next_cursor,
    };
  },
});

const detail = defineCommand({
  id: "deployed.monitoring-workspace",
  title: l10n("cloud-workspaces.monitoring-detail-command", "Read a monitored workspace"),
  cli: true,
  params: {
    range: rangeParam,
    machineId: params.text({ label: l10n("cloud-workspaces.machine-id", "Machine ID"), required: true }),
    asOf: params.number({
      label: l10n("cloud-workspaces.monitoring-observed-at", "Observation time (Unix milliseconds)"),
    }),
  },
  async run(ctx, input) {
    const [settings, machine] = await Promise.all([
      ctx.settings.all(),
      getDeployed<ControllerMachine>(ctx.connections, machinePath(input.machineId), ctx.signal),
    ]);
    return {
      resource: projectDeployedMachineResource(ctx, machine),
      reason: machine.reason_code,
      ...projectUsage(
        machine,
        input.range,
        input.asOf ?? Date.now(),
        parseRates(settings.monitoringHourlyUsd),
        parseDefaultRate(settings.monitoringDefaultHourlyUsd),
      ),
    };
  },
});

export const monitoringCommands = {
  "deployed.monitoring-summary": summary,
  "deployed.monitoring-workspaces": list,
  "deployed.monitoring-workspace": detail,
};
