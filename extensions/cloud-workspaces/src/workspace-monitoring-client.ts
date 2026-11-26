import type { WebviewClient } from "@pstdio/sdk/extensions";
import type { monitoringCommands } from "./workspace-monitoring-commands";

export type MonitoringClient = WebviewClient<typeof monitoringCommands>;
export type MonitoringList = Awaited<ReturnType<MonitoringClient["commands"]["deployed.monitoring-workspaces"]>>;
export type MonitoringSummary = Awaited<ReturnType<MonitoringClient["commands"]["deployed.monitoring-summary"]>>;
export type MonitoringDetail = Awaited<ReturnType<MonitoringClient["commands"]["deployed.monitoring-workspace"]>>;
