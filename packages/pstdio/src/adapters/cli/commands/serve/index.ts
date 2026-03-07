import type { Argv } from "yargs";
import { serveApp } from "./serve-app";

export const command = "serve";
export const describe = "Start API server and dashboard in a single process";

export const builder = (yargs: Argv) =>
  yargs.option("port", { type: "number", default: 19840, describe: "Server port" });

export const handler = async (args: { port: number }) => {
  await serveApp({ port: args.port });
};
