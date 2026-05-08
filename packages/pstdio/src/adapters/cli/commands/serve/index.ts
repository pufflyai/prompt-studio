import type { Argv } from "yargs";
import { serveApp } from "./serve-app";

export const command = "serve";
export const describe = "Start API server and dashboard in a single process";

export const builder = (yargs: Argv) =>
  yargs.option("port", { type: "number", default: 19840, describe: "Server port" }).option("host", {
    type: "string",
    default: "localhost",
    describe: "Interface to bind to (e.g. 0.0.0.0 for LAN access; no auth, trusted networks only)",
  });

export const handler = async (args: { port: number; host: string }) => {
  await serveApp({ port: args.port, host: args.host });
};
