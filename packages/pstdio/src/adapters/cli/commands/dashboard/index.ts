import type { Server } from "node:http";
import type { Argv } from "yargs";
import { openBrowser as defaultOpenBrowser } from "../../dashboard/open-browser";
import { resolveDashboardRoot as defaultResolveDashboardRoot } from "../../dashboard/resolve-dashboard-root";
import { serveDashboard as defaultServeDashboard } from "../../dashboard/serve-dashboard";

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

export const launch = async (options: LaunchOptions, deps: LaunchDeps = defaultDeps) => {
  const { apiPort, dashboardPort, openBrowser } = options;
  const apiUrl = `http://localhost:${apiPort}`;
  const dashboardUrl = `http://localhost:${dashboardPort}`;

  const dashboardRoot = deps.resolveDashboardRoot(process.cwd());
  const server = deps.serveDashboard({
    root: dashboardRoot,
    port: dashboardPort,
    config: { apiBaseUrl: apiUrl },
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
    .option("api-port", { type: "number", default: 3000, describe: "API server port" })
    .option("dashboard-port", { type: "number", default: 5555, describe: "Dashboard server port" })
    .option("open-browser", { type: "boolean", default: true, describe: "Open dashboard in browser" });

export const handler = async (args: { apiPort: number; dashboardPort: number; openBrowser: boolean }) => {
  await launch(args);
};
