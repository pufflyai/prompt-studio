import type { Server } from "node:http";
import type { Argv } from "yargs";
import { CLI_VERSION } from "@/features/cli-version";
import { openBrowser as defaultOpenBrowser } from "../../dashboard/open-browser";
import { resolveDashboardRoot as defaultResolveDashboardRoot } from "../../dashboard/resolve-dashboard-root";
import { serveDashboard as defaultServeDashboard } from "../../dashboard/serve-dashboard";
import { isCompiledBinary } from "../serve/embedded-assets";

type LaunchDeps = {
  serveDashboard: typeof defaultServeDashboard;
  resolveDashboardRoot: typeof defaultResolveDashboardRoot;
  openBrowser: (url: string) => void;
};

const defaultDeps: LaunchDeps = {
  serveDashboard: defaultServeDashboard,
  resolveDashboardRoot: defaultResolveDashboardRoot,
  openBrowser: defaultOpenBrowser,
};

type LaunchOptions = {
  apiPort: number;
  dashboardPort: number;
  openBrowser: boolean;
};

const launchCompiled = (options: LaunchOptions, deps: Pick<LaunchDeps, "openBrowser">) => {
  // Startup middleware publishes the descriptor origin before the dashboard command runs.
  const url = process.env.PSTDIO_API_URL ?? `http://127.0.0.1:${options.apiPort}`;

  if (options.openBrowser) {
    deps.openBrowser(url);
  }

  process.stdout.write(`Dashboard: ${url}\n`);
  process.stdout.write(`API:       ${url}/v1\n`);
};

export const launch = async (options: LaunchOptions, deps: LaunchDeps = defaultDeps, compiled = isCompiledBinary()) => {
  if (compiled) {
    launchCompiled(options, deps);
    return;
  }

  const { apiPort, dashboardPort, openBrowser } = options;
  const apiUrl = process.env.PSTDIO_API_URL ?? `http://localhost:${apiPort}`;
  const dashboardUrl = `http://localhost:${dashboardPort}`;

  const dashboardRoot = deps.resolveDashboardRoot(process.cwd());
  const server = deps.serveDashboard({
    root: dashboardRoot,
    port: dashboardPort,
    config: { apiBaseUrl: apiUrl, version: CLI_VERSION },
  });

  if (openBrowser) {
    deps.openBrowser(dashboardUrl);
  }

  process.stdout.write(`Dashboard: ${dashboardUrl}\n`);
  process.stdout.write(`API:       ${apiUrl}\n`);

  const shutdown = () => {
    (server as Server).close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

export const command = "$0";
export const describe = "Start API and dashboard, then open in browser";

export const builder = (yargs: Argv) =>
  yargs
    .option("api-port", { type: "number", default: 19840, describe: "API server port" })
    .option("dashboard-port", { type: "number", default: 5555, describe: "Dashboard server port" })
    .option("open-browser", { type: "boolean", default: true, describe: "Open dashboard in browser" });

export const handler = async (args: { apiPort: number; dashboardPort: number; openBrowser: boolean }) => {
  await launch(args);
};
