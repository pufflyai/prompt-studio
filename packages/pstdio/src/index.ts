import { readFile } from "node:fs/promises";

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { topLevelCommandModules } from "./adapters/cli/commands";
import * as dashboardCommand from "./adapters/cli/commands/dashboard";
import { API_URL } from "./features/api-url";
import { ensureApi } from "./features/ensure-api";

const packageData = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

if (!process.env.PSTDIO_VERSION && typeof packageData.version === "string" && packageData.version.length > 0) {
  process.env.PSTDIO_VERSION = packageData.version;
}

const resolveApiUrl = (argv: Record<string, unknown>) => {
  if (process.env.PSTDIO_API_URL) return process.env.PSTDIO_API_URL;

  const apiPort = argv["api-port"];
  if (typeof apiPort === "number") return `http://localhost:${apiPort}`;

  return API_URL;
};

const applyApiPortFromArgs = (argv: Record<string, unknown>) => {
  if (process.env.PSTDIO_API_URL || process.env.PSTDIO_API_PORT) return;

  const apiPort = argv["api-port"];
  if (typeof apiPort !== "number") return;

  process.env.PSTDIO_API_PORT = String(apiPort);
};

const cli = yargs(hideBin(process.argv))
  .scriptName("pstdio")
  .version(packageData.version)
  .strict()
  .fail((msg, err, yargs) => {
    if (err) {
      process.stderr.write(`Error: ${err.message}\n`);
      process.exit(1);
    }
    process.stderr.write(`${msg}\n\n`);
    yargs.showHelp("error");
    process.stderr.write("\n");
    process.exit(1);
  })
  .middleware(async (argv) => {
    const topLevelCommand = argv._[0];
    if (topLevelCommand === "close" || topLevelCommand === "tui" || topLevelCommand === "serve") return;

    applyApiPortFromArgs(argv);
    await ensureApi(resolveApiUrl(argv));
  })
  .command(dashboardCommand);

for (const mod of topLevelCommandModules) {
  // biome-ignore lint/suspicious/noExplicitAny: yargs CommandModule union requires cast
  cli.command(mod as any);
}

cli.parseAsync().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
});
