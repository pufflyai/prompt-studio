import { API_URL } from "@/features/api-url";
import { ensureApi as defaultEnsureApi } from "@/features/ensure-api";

type CliArgv = Record<string, unknown>;
type CliEnv = Record<string, string | undefined>;
type EnsureApi = (apiUrl: string) => Promise<void>;

type EnsureCliApiInput = {
  argv: CliArgv;
  defaultApiUrl?: string;
  ensureApi?: EnsureApi;
  env: CliEnv;
};

const resolveApiPort = (argv: CliArgv) => {
  const apiPort = argv["api-port"];
  if (typeof apiPort !== "number") return;

  return apiPort;
};

const commandToken = (argv: CliArgv, index: number) => {
  const tokens = argv._;
  if (!Array.isArray(tokens)) return;

  const token = tokens[index];
  if (typeof token !== "string") return;

  return token;
};

const shouldEnsureApi = (argv: CliArgv) => {
  const topLevelCommand = commandToken(argv, 0);
  const subCommand = commandToken(argv, 1);

  if (topLevelCommand === "close" || topLevelCommand === "serve") return false;
  if (topLevelCommand === "extensions" && subCommand === "add") return false;

  return true;
};

const resolveApiUrl = (input: EnsureCliApiInput) => {
  if (input.env.PSTDIO_API_URL) return input.env.PSTDIO_API_URL;

  const apiPort = resolveApiPort(input.argv);
  if (apiPort !== undefined) return `http://localhost:${apiPort}`;

  return input.defaultApiUrl ?? API_URL;
};

const applyApiPort = (input: EnsureCliApiInput) => {
  if (input.env.PSTDIO_API_URL || input.env.PSTDIO_API_PORT) return;

  const apiPort = resolveApiPort(input.argv);
  if (apiPort === undefined) return;

  input.env.PSTDIO_API_PORT = String(apiPort);
};

export const ensureCliApi = async (input: EnsureCliApiInput) => {
  if (!shouldEnsureApi(input.argv)) return;

  applyApiPort(input);
  await (input.ensureApi ?? defaultEnsureApi)(resolveApiUrl(input));
};
