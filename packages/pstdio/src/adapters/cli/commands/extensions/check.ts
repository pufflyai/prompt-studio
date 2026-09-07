import { join } from "node:path";
import { EXTENSION_API_VERSION, SDK_VERSION } from "@pstdio/sdk/extensions";
import {
  checkExtensionsRoot,
  dashboardExtensionHostCapabilities,
  formatExtensionsCheck,
  resolvePstdioHome,
} from "pstdio-api/extensions/install-extension-source";
import type { Arguments, Argv } from "yargs";
import { CLI_VERSION } from "@/features/cli-version";
import { findGitRoot } from "@/features/config/config";
import type { ExtensionsCheckArgs } from "./shared";

export const command = "check";
export const describe = "Validate installed extension sources";

export const builder = (yargs: Argv) =>
  yargs
    .option("scope", {
      choices: ["repo", "user"] as const,
      describe: "Check only repo-local or user extensions; checks both when omitted",
    })
    .option("json", {
      type: "boolean",
      default: false,
      describe: "Print diagnostics as JSON",
    });

type Deps = {
  checkExtensionsRoot: typeof checkExtensionsRoot;
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  log: (message: string) => void;
  resolvePstdioHome: typeof resolvePstdioHome;
};

const defaultDeps: Deps = {
  checkExtensionsRoot,
  cwd: () => process.cwd(),
  findGitRoot,
  log: console.log,
  resolvePstdioHome,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<ExtensionsCheckArgs>) => {
    const gitRoot = argv.scope === "user" ? null : deps.findGitRoot(deps.cwd());
    if (argv.scope === "repo" && !gitRoot) throw new Error("Run the repo scope inside a Git repository.");
    const roots: string[] = [];
    if (argv.scope !== "repo") roots.push(join(deps.resolvePstdioHome({ env: process.env }), "extensions"));
    if (gitRoot) roots.push(join(gitRoot, ".pstdio", "extensions"));
    const checks = [];
    const versions = {
      cli: CLI_VERSION,
      extensionApi: EXTENSION_API_VERSION,
      sdk: SDK_VERSION,
      dashboard: CLI_VERSION,
    };

    for (const root of roots) {
      checks.push(
        await deps.checkExtensionsRoot(root, {
          hostCapabilities: { ...dashboardExtensionHostCapabilities, hostVersion: CLI_VERSION },
        }),
      );
    }

    const versionSummary = `CLI: ${versions.cli}\nExtension API: ${versions.extensionApi}\nSDK: ${versions.sdk}\nDashboard (bundled): ${versions.dashboard}`;
    deps.log(
      argv.json
        ? JSON.stringify({ versions, checks }, null, 2)
        : [versionSummary, ...checks.map(formatExtensionsCheck)].join("\n\n"),
    );

    const errorCount = checks.reduce((total, check) => total + check.errorCount, 0);
    if (errorCount > 0) {
      throw new Error(`Extension check failed with ${errorCount} error(s)`);
    }
  };

export const handler = createHandler();
