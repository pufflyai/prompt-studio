import { dirname, isAbsolute, join, resolve } from "node:path";
import { EXTENSION_API_VERSION } from "@pstdio/sdk/extensions";
import {
  checkExtensionSource,
  checkExtensionsRoot,
  formatExtensionsCheck,
  resolvePstdioHome,
} from "pstdio-api/extensions/install-extension-source";
import type { Arguments, Argv } from "yargs";
import { CLI_VERSION } from "@/features/cli-version";
import { findGitRoot } from "@/features/config/config";
import { SDK_VERSION } from "@/features/sdk-version";
import type { ExtensionsCheckArgs } from "./shared";

export const command = "check [source]";
export const describe = "Validate installed extension sources";

export const builder = (yargs: Argv) =>
  yargs
    .positional("source", {
      type: "string",
      describe: "Path to one extension folder to check on its own",
    })
    .option("scope", {
      type: "string",
      choices: ["repo", "user"] as const,
      describe: "Check only the repo-local or the user extensions root",
    })
    .option("json", {
      type: "boolean",
      default: false,
      describe: "Print diagnostics as JSON",
    });

type Deps = {
  checkExtensionSource: typeof checkExtensionSource;
  checkExtensionsRoot: typeof checkExtensionsRoot;
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  log: (message: string) => void;
  resolvePstdioHome: typeof resolvePstdioHome;
};

const defaultDeps: Deps = {
  checkExtensionSource,
  checkExtensionsRoot,
  cwd: () => process.cwd(),
  findGitRoot,
  log: console.log,
  resolvePstdioHome,
};

const resolveRoots = (deps: Deps, scope: string | undefined) => {
  const userRoot = join(deps.resolvePstdioHome({ env: process.env }), "extensions");
  const gitRoot = deps.findGitRoot(deps.cwd());
  const repoRoot = gitRoot ? join(gitRoot, ".pstdio", "extensions") : null;

  if (scope === "user") return [userRoot];
  if (scope === "repo") {
    if (!repoRoot) throw new Error("--scope repo requires a git repository; run inside a linked repo.");
    return [repoRoot];
  }
  return [userRoot, ...(repoRoot ? [repoRoot] : [])];
};

const formatVersions = (versions: Record<string, string>, status: string) =>
  [
    "Versions:",
    `  CLI: ${versions.cli}`,
    `  Extension API: ${versions.extensionApi}`,
    `  SDK: ${versions.sdk}`,
    `  Dashboard host: ${versions.dashboard} (${status})`,
  ].join("\n");

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<ExtensionsCheckArgs>) => {
    if (argv.source && argv.scope) throw new Error("Pass a source path or --scope, not both.");

    const checks = [];
    if (argv.source) {
      const sourcePath = isAbsolute(argv.source) ? argv.source : resolve(deps.cwd(), argv.source);
      const { check } = await deps.checkExtensionSource(sourcePath, dirname(sourcePath));
      checks.push(check);
    } else {
      for (const root of resolveRoots(deps, argv.scope)) {
        checks.push(await deps.checkExtensionsRoot(root));
      }
    }

    const compatibility = checks[0]?.hostCompatibility;
    const versions = {
      cli: CLI_VERSION,
      extensionApi: EXTENSION_API_VERSION,
      sdk: SDK_VERSION,
      dashboard: compatibility?.host?.hostVersion ?? "unknown",
    };

    deps.log(
      argv.json
        ? JSON.stringify({ versions, checks }, null, 2)
        : [formatVersions(versions, compatibility?.status ?? "unknown"), ...checks.map(formatExtensionsCheck)].join(
            "\n\n",
          ),
    );

    const errorCount = checks.reduce((total, check) => total + check.errorCount, 0);
    if (errorCount > 0) {
      throw new Error(`Extension check failed with ${errorCount} error(s)`);
    }
  };

export const handler = createHandler();
