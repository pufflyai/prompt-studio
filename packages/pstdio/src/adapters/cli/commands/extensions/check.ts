import { resolve } from "node:path";
import { EXTENSION_API_VERSION, SDK_VERSION } from "@pstdio/sdk/extensions";
import { checkExtensions, formatCheckReport, readPackageManifestMetadata } from "pstdio-extensions";
import { formatExtensionsCheck } from "pstdio-extensions/authoring";
import type { Arguments, Argv } from "yargs";
import { apiClient } from "@/features/api-client";
import { resolveApiUrl } from "@/features/api-url";
import { CLI_VERSION } from "@/features/cli-version";
import { findProjectRoot, readConfig } from "@/features/config/config";
import { ensureApi } from "@/features/ensure-api";
import type { ExtensionsCheckArgs } from "./shared";

export const command = "check [source]";
export const describe = "Validate a local source or the host's installed extensions";
export const builder = (yargs: Argv) =>
  yargs
    .positional("source", { type: "string", describe: "Local authoring folder" })
    .option("scope", {
      choices: ["repo", "user"] as const,
      describe: "Check the host's repo or user extensions; checks both when omitted",
    })
    .option("json", { type: "boolean", default: false, describe: "Print diagnostics as JSON" });

type Deps = {
  cwd: () => string;
  findProjectRoot: typeof findProjectRoot;
  readConfig: typeof readConfig;
  ensureApi: typeof ensureApi;
  apiUrl: () => string;
  diagnostics: ReturnType<typeof apiClient>["extensions"]["diagnostics"];
  checkLocal: typeof checkExtensions;
  log: (message: string) => void;
};
const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findProjectRoot,
  readConfig,
  ensureApi,
  apiUrl: resolveApiUrl,
  diagnostics: (...args) => apiClient().extensions.diagnostics(...args),
  checkLocal: checkExtensions,
  log: console.log,
};

// The versions of this pst. A source check compares the manifest range with this
// extension API version; an installed check runs on the host with the host's version.
const toolVersions = { cli: CLI_VERSION, extensionApi: EXTENSION_API_VERSION, sdk: SDK_VERSION };
const toolLine = `This pst: extension API ${toolVersions.extensionApi} (pst ${toolVersions.cli}, SDK ${toolVersions.sdk})`;

const checkSource = async (deps: Deps, argv: Arguments<ExtensionsCheckArgs>, source: string) => {
  const path = resolve(deps.cwd(), source);
  const check = await deps.checkLocal({
    extensionsRoot: path,
    extensionPackages: [{ path, sourceKind: "local_path" }],
    extensionRoots: [],
    apiProvider: "pst",
  });
  const manifestRange = readPackageManifestMetadata(path).manifest?.enginesPstdio ?? null;
  const target = { kind: "source", path };
  deps.log(
    argv.json
      ? JSON.stringify({ target, versions: { ...toolVersions, manifestRange }, check }, null, 2)
      : [
          `Checked: source folder ${path} (not installed, so no host took part)`,
          toolLine,
          `Manifest engines.pstdio: ${manifestRange ?? "not declared"}`,
          "",
          formatCheckReport(check),
        ].join("\n"),
  );
  if (check.errorCount) throw new Error(`Extension check failed with ${check.errorCount} error(s)`);
};

const checkInstalled = async (deps: Deps, argv: Arguments<ExtensionsCheckArgs>) => {
  const root = deps.findProjectRoot(deps.cwd());
  const projectId = root && deps.readConfig(root)?.project_id;
  if (!projectId)
    throw new Error(
      `No linked project found from ${deps.cwd()}. Installed checks ask the host of a linked project, so run this from your project folder. To check a source folder without a host, run \`pst extensions check <path>\`.`,
    );
  await deps.ensureApi(process.env.PSTDIO_API_URL);
  const { roots } = await deps.diagnostics(projectId, { scope: argv.scope });
  const checks = roots.map(({ scope, check }) => ({ scope, ...check }));
  const target = { kind: "installed", projectId, host: deps.apiUrl() };
  deps.log(
    argv.json
      ? JSON.stringify({ target, versions: toolVersions, checks }, null, 2)
      : [
          `Checked: extensions installed on the host at ${target.host} for project ${projectId}`,
          `${toolLine}. The host checks engines.pstdio with its own extension API version.`,
          ...checks.map((check) => `\n${check.scope} extensions\n${formatExtensionsCheck(check)}`),
        ].join("\n"),
  );
  const errors = checks.reduce((count, check) => count + check.errorCount, 0);
  if (errors) throw new Error(`Extension check failed with ${errors} error(s)`);
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<ExtensionsCheckArgs>) => {
    if (!argv.source) return checkInstalled(deps, argv);
    if (argv.scope) throw new Error("Choose a local source or an installed scope.");
    return checkSource(deps, argv, argv.source);
  };
export const handler = createHandler();
