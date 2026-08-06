import type { Argv } from "yargs";
import { ensureApi } from "@/features/ensure-api";
import { promoteRuntime } from "@/features/runtime/runtime-client";
import { serveApp } from "./serve-app";

export const command = "serve";
export const describe = "Start API server and dashboard in a single process";

export const builder = (yargs: Argv) =>
  yargs
    .option("port", { type: "number", default: 0, describe: "Server port (0 selects an available port)" })
    .option("host", {
      type: "string",
      default: "127.0.0.1",
      describe: "Interface to bind to",
    })
    .option("foreground", { type: "boolean", default: false, hidden: true })
    .option("owner", { choices: ["desktop", "persistent"] as const, default: "persistent", hidden: true });

type ServeArgs = {
  port: number;
  host: string;
  foreground: boolean;
  owner: "desktop" | "persistent";
};

type ServeDeps = {
  ensureApi: typeof ensureApi;
  promoteRuntime: typeof promoteRuntime;
  serveApp: typeof serveApp;
  log: (message: string) => void;
};

const defaultDeps: ServeDeps = {
  ensureApi,
  promoteRuntime,
  serveApp,
  log: (message) => process.stdout.write(`${message}\n`),
};

export const createHandler =
  (deps: ServeDeps = defaultDeps) =>
  async (args: ServeArgs) => {
    if (args.foreground) {
      await deps.serveApp({ port: args.port, host: args.host, ownerType: args.owner });
      return;
    }

    if (args.host !== "127.0.0.1") throw new Error("Detached pstdio runtimes must bind to 127.0.0.1");
    if (args.port !== 0) process.env.PSTDIO_API_PORT = String(args.port);

    const descriptor = await deps.ensureApi(undefined);
    if (!descriptor) throw new Error("Runtime discovery did not return a descriptor");
    await deps.promoteRuntime(descriptor);
    deps.log(`pstdio serve: ${descriptor.origin}`);
  };

export const handler = createHandler();
