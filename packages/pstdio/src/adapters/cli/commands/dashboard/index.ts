import type { Argv } from "yargs";
import { openBrowser as defaultOpenBrowser } from "../../dashboard/open-browser";

type LaunchOptions = {
  apiPort: number;
  openBrowser: boolean;
};

type LaunchDeps = {
  openBrowser: (url: string) => void;
};

const defaultDeps: LaunchDeps = {
  openBrowser: defaultOpenBrowser,
};

// The API auto-start middleware brings up a single `serve` process that hosts
// the API and the dashboard on one origin, then publishes its URL as
// PSTDIO_API_URL. Point the browser there. A separate dashboard server on
// another port would be a cross-origin caller, which the runtime rejects.
export const launch = async (options: LaunchOptions, deps: LaunchDeps = defaultDeps) => {
  const url = process.env.PSTDIO_API_URL ?? `http://127.0.0.1:${options.apiPort}`;

  if (options.openBrowser) {
    deps.openBrowser(url);
  }

  process.stdout.write(`Dashboard: ${url}\n`);
  process.stdout.write(`API:       ${url}/v1\n`);
};

export const command = "$0";
export const describe = "Start the API and dashboard, then open the browser";

export const builder = (yargs: Argv) =>
  yargs
    .option("api-port", { type: "number", default: 19840, describe: "API server port" })
    .option("open-browser", { type: "boolean", default: true, describe: "Open the dashboard in the browser" });

export const handler = async (args: { apiPort: number; openBrowser: boolean }) => {
  await launch(args);
};
