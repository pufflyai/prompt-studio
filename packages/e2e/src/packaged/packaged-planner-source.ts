import { join } from "node:path";
import { preparePackagedExtensionSource } from "./packaged-extension-source";

const repoRoot = join(import.meta.dirname, "../../../..");

export const preparePlannerSource = (root: string, options: { offline?: boolean; sourcePath?: string } = {}) =>
  preparePackagedExtensionSource(root, options.sourcePath ?? join(repoRoot, "extensions/pstdio-planner"), options);
