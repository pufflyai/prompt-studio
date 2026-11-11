import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { preparedUiSourcesPath } from "./scripts/prepare-ui-fixtures";

const repoRoot = resolve(import.meta.dirname, "../../..");
const sourcesPath = process.env.E2E_HOME ? preparedUiSourcesPath(process.env.E2E_HOME) : undefined;
const preparedSources = JSON.parse(
  process.env.E2E_EXTENSION_SOURCES ??
    (sourcesPath && existsSync(sourcesPath) ? readFileSync(sourcesPath, "utf8") : "{}"),
) as Record<string, string>;

const extensionSource = (name: string) => {
  if (name === "workbench-fixture") return "packages/workbench-fixture";
  return name.includes("/") ? name : `extensions/${name}`;
};
export const e2eExtension = (name: string) => {
  const installName = name.split("/").at(-1) as string;
  const prepared = preparedSources[installName];
  return {
    source: prepared ?? resolve(repoRoot, extensionSource(name)),
    installName,
    // Prepared consumers install their own fresh public dependencies in the runtime.
    ...(prepared
      ? {}
      : {
          skipInstall:
            name !== "workbench-fixture" && !name.includes("/fixtures/") && !name.startsWith(".pstdio/extensions/"),
        }),
  };
};

// Each extension is also an e2e devDependency, so CI runs e2e for pull requests that change it.
// pstdio-reports stays out so the Marketplace lifecycle spec can install it.
const e2eDefaultExtensions = [
  e2eExtension("pstdio-cloud"),
  e2eExtension("pstdio-home"),
  e2eExtension("pstdio-session-browser"),
  e2eExtension("pstdio-workspaces"),
  e2eExtension("pstdio-base-themes"),
  e2eExtension("canvas"),
  e2eExtension("pstdio-artifacts"),
  e2eExtension("pstdio-notes"),
  e2eExtension("pstdio-performance"),
  e2eExtension("pstdio-planner"),
  e2eExtension("pstdio-skills"),
  e2eExtension("harness-claude-code"),
  e2eExtension("harness-codex"),
  e2eExtension("harness-open-code"),
];

export const PSTDIO_E2E_DEFAULT_EXTENSIONS = JSON.stringify({ defaultExtensions: e2eDefaultExtensions });

export const PSTDIO_E2E_PLANNER_EXTENSION = JSON.stringify({
  defaultExtensions: [e2eExtension("pstdio-planner")],
});

// Build a PSTDIO_DEFAULT_EXTENSIONS payload that installs only the named extensions, so a CLI
// test's first `projects create` skips the npm install of extensions it never exercises.
export const e2eExtensions = (...names: string[]) => JSON.stringify({ defaultExtensions: names.map(e2eExtension) });
