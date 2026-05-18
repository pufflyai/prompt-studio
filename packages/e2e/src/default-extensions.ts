import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../../..");

export const PSTDIO_E2E_DEFAULT_EXTENSIONS = JSON.stringify([
  {
    source: resolve(repoRoot, "extensions/pstdio-core-skills"),
    installName: "pstdio-core-skills",
    skipInstall: true,
  },
  {
    source: resolve(repoRoot, "extensions/pstdio-core-templates"),
    installName: "pstdio-core-templates",
    skipInstall: true,
  },
  {
    source: resolve(repoRoot, "extensions/pstdio-core-workspace"),
    installName: "pstdio-core-workspace",
    skipInstall: true,
  },
]);
