import { resolve } from "node:path";
import { EXTENSION_API_VERSION, SDK_VERSION } from "@pstdio/sdk/extensions";
import { checkExtensions, formatCheckReport } from "pstdio-extensions";
import { formatExtensionsCheck } from "pstdio-extensions/authoring";
import type { Arguments, Argv } from "yargs";
import { apiClient } from "@/features/api-client";
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
  diagnostics: ReturnType<typeof apiClient>["extensions"]["diagnostics"];
  checkLocal: typeof checkExtensions;
  log: (message: string) => void;
};
const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findProjectRoot,
  readConfig,
  ensureApi,
  diagnostics: (...args) => apiClient().extensions.diagnostics(...args),
  checkLocal: checkExtensions,
  log: console.log,
};
export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<ExtensionsCheckArgs>) => {
    const versions = {
      cli: CLI_VERSION,
      extensionApi: EXTENSION_API_VERSION,
      sdk: SDK_VERSION,
      dashboard: CLI_VERSION,
    };
    if (argv.source) {
      if (argv.scope) throw new Error("Choose a local source or an installed scope.");
      const path = resolve(deps.cwd(), argv.source);
      const check = await deps.checkLocal({
        extensionsRoot: path,
        extensionPackages: [{ path, sourceKind: "local_path" }],
        extensionRoots: [],
      });
      deps.log(argv.json ? JSON.stringify({ versions, check }, null, 2) : formatCheckReport(check));
      if (check.errorCount) throw new Error(`Extension check failed with ${check.errorCount} error(s)`);
      return;
    }
    const root = deps.findProjectRoot(deps.cwd());
    const projectId = root && deps.readConfig(root)?.project_id;
    if (!projectId) throw new Error("Run installed extension checks inside a linked project.");
    await deps.ensureApi(process.env.PSTDIO_API_URL);
    const { roots } = await deps.diagnostics(projectId, { scope: argv.scope });
    const checks = roots.map((root) => root.check);
    deps.log(
      argv.json
        ? JSON.stringify({ versions, checks }, null, 2)
        : [
            `CLI: ${versions.cli}\nExtension API: ${versions.extensionApi}\nSDK: ${versions.sdk}\nDashboard (bundled): ${versions.dashboard}`,
            ...checks.map(formatExtensionsCheck),
          ].join("\n\n"),
    );
    const errors = checks.reduce((count, check) => count + check.errorCount, 0);
    if (errors) throw new Error(`Extension check failed with ${errors} error(s)`);
  };
export const handler = createHandler();
