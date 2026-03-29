import { join, resolve } from "node:path";
import { scaffoldBundledFiles } from "./scaffold-bundled-files";

const EMBEDDED_HOOKS_PREFIX = "../files/hooks/";

export const scaffoldBundledHooks = async (
  repoPath: string,
  bundledHooksDir = resolve(import.meta.dirname, "../../../../pstdio/files/hooks"),
) =>
  scaffoldBundledFiles(join(repoPath, ".pstdio", "hooks"), {
    bundledSourceDir: bundledHooksDir,
    embeddedPrefix: EMBEDDED_HOOKS_PREFIX,
  });
