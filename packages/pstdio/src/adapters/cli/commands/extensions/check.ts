import { join } from "node:path";
import {
  checkExtensionsRoot,
  formatExtensionsCheck,
  resolvePstdioHome,
} from "pstdio-api/extensions/install-extension-source";
import type { Arguments, Argv } from "yargs";
import { findGitRoot } from "@/features/config/config";
import type { ExtensionsCheckArgs } from "./shared";

export const command = "check";
export const describe = "Validate installed extension sources";

export const builder = (yargs: Argv) =>
  yargs.option("json", {
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
    const extensionsRoot = join(deps.resolvePstdioHome({ env: process.env }), "extensions");
    const gitRoot = deps.findGitRoot(deps.cwd());
    const roots = [extensionsRoot, ...(gitRoot ? [join(gitRoot, ".pstdio", "extensions")] : [])];
    const checks = [];

    for (const root of roots) {
      checks.push(await deps.checkExtensionsRoot(root));
    }

    deps.log(argv.json ? JSON.stringify({ checks }, null, 2) : checks.map(formatExtensionsCheck).join("\n"));

    const errorCount = checks.reduce((total, check) => total + check.errorCount, 0);
    if (errorCount > 0) {
      throw new Error(`Extension check failed with ${errorCount} error(s)`);
    }
  };

export const handler = createHandler();
