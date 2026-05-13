import { join } from "node:path";
import {
  checkExtensionsRoot,
  checkExtensionsRoots,
  formatExtensionsCheck,
  resolvePstdioHome,
} from "pstdio-api/extensions/install-extension-source";
import type { Arguments, Argv } from "yargs";
import { findGitRoot } from "../../../../features/config/config";
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
  checkExtensionsRoots: typeof checkExtensionsRoots;
  log: (message: string) => void;
  resolvePstdioHome: typeof resolvePstdioHome;
};

const defaultDeps: Deps = {
  checkExtensionsRoot,
  checkExtensionsRoots,
  log: console.log,
  resolvePstdioHome,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<ExtensionsCheckArgs>) => {
    const extensionsRoot = join(deps.resolvePstdioHome({ env: process.env }), "extensions");
    const gitRoot = findGitRoot(process.cwd());
    const roots = [extensionsRoot, ...(gitRoot ? [join(gitRoot, ".pstdio", "extensions")] : [])];
    const check = await deps.checkExtensionsRoots(roots);
    deps.log(argv.json ? JSON.stringify(check, null, 2) : formatExtensionsCheck(check));

    if (check.errorCount > 0) {
      throw new Error(`Extension check failed with ${check.errorCount} error(s)`);
    }
  };

export const handler = createHandler();
