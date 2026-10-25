import { readdirSync } from "node:fs";
import { resolve } from "node:path";

export const allComponentChecks = readdirSync(resolve(import.meta.dir, "../../packages/storybook-tests/src/ui"))
  .filter((file) => file.endsWith(".spec.ts"))
  .sort();

const workbenchEssentials = [
  "panel-tabs.spec.ts",
  "session-resource-actions.spec.ts",
  "workbench-view-placement.spec.ts",
];
const dashboardEssentials = ["workspace-sessions.spec.ts"];
export const sharedComponentEssentials = ["menu-dialog.spec.ts", ...workbenchEssentials, ...dashboardEssentials];
const families = [
  {
    pattern: /^packages\/ui\/src\/components\/data-table\//,
    specs: ["data-table-editing.spec.ts", "data-table-search.spec.ts"],
  },
  { pattern: /^packages\/ui\/src\/.*mermaid/, specs: ["mermaid-renderer.spec.ts"] },
  {
    pattern: /^packages\/ui\/src\/.*(markdown|rich-text|editor)/,
    specs: ["markdown-table-editor.spec.ts", "markdown-image-command.spec.ts", "mermaid-renderer.spec.ts"],
  },
  {
    pattern: /^packages\/ui\/src\/components\/(overlays|navigation|searchable-menu)\//,
    specs: ["menu-dialog.spec.ts", "panel-tabs.spec.ts"],
  },
  { pattern: /^packages\/ui\/src\/.*(tree-list|virtual)/, specs: ["tree-list-hidden.spec.ts"] },
  { pattern: /^packages\/ui\/src\/.*(collection-badge|resource-link)/, specs: ["collection-badge-list.spec.ts"] },
  { pattern: /^packages\/ui\/src\/.*terminal/, specs: ["terminal-links.spec.ts"] },
  {
    pattern: /^packages\/pstdio-workbench\/src\/.*(breadcrumb|resource-action|tab-action)/,
    specs: ["session-resource-actions.spec.ts", "panel-tabs.spec.ts"],
  },
  {
    pattern: /^packages\/pstdio-workbench\/src\/.*(panel|region|layout|drag|drop|fullscreen|core-api)/,
    specs: [
      "main-fullscreen.spec.ts",
      "panel-drop-feedback.spec.ts",
      "panel-edge-placement.spec.ts",
      "panel-placement.spec.ts",
      "panel-policy.spec.ts",
      "panel-tabs.spec.ts",
      "workbench-view-placement.spec.ts",
    ],
  },
  {
    pattern: /^packages\/pstdio-dashboard\/src\/.*(sidenav|session-navigation)/,
    specs: ["sidenav-header.spec.ts", "workspace-sessions.spec.ts"],
  },
  { pattern: /^extensions\/pstdio-planner\/.*(milestone|eta|forecast)/, specs: ["planner-milestone-eta.spec.ts"] },
  { pattern: /^extensions\/pstdio-artifacts\//, specs: ["artifacts.spec.ts", "html-preview.spec.ts"] },
];

const isShared = (file: string) =>
  /^(scripts\/|\.github\/|packages\/(sdk|pstdio-api-contracts)\/)/.test(file) ||
  /^(bun\.lock|bunfig\.toml|package\.json|nx\.json|tsconfig\.base\.json|\.npmrc)$/.test(file) ||
  /^packages\/ui\/(package\.json|\.storybook\/|src\/theme\/|src\/index\.)/.test(file) ||
  /^packages\/storybook-tests\/(?!src\/ui\/[^/]+\.spec\.ts$)/.test(file);

export const selectComponentChecks = (changedFiles: string[]) => {
  const selected = new Set<string>();
  const reasons = new Set<string>();
  const include = (files: string[], reason: string) => {
    for (const file of files) if (allComponentChecks.includes(file)) selected.add(file);
    reasons.add(reason);
  };
  for (const file of changedFiles) {
    if (file.endsWith(".md") || /\.test\.tsx?$/.test(file)) continue;
    const direct = file.match(/^packages\/storybook-tests\/src\/ui\/([^/]+\.spec\.ts)$/);
    if (direct) {
      include([direct[1]], `changed spec ${direct[1]}`);
      continue;
    }
    if (/^extensions\/[^/]+\/(package\.json|bun\.lock|tsconfig[^/]*\.json)$/.test(file)) continue;
    if (isShared(file)) {
      include(sharedComponentEssentials, `shared input ${file}`);
      continue;
    }
    const family = families.find((candidate) => candidate.pattern.test(file));
    if (family) {
      include(family.specs, `related component family ${file}`);
      continue;
    }
    const owner = file.match(/^packages\/(ui|pstdio-workbench|pstdio-dashboard)\//)?.[1];
    if (!owner) continue;
    let essentials = ["menu-dialog.spec.ts"];
    if (owner === "pstdio-workbench") essentials = workbenchEssentials;
    if (owner === "pstdio-dashboard") essentials = dashboardEssentials;
    include(essentials, `${owner} owner fallback ${file}`);
  }
  return { files: [...selected].sort().map((file) => `src/ui/${file}`), reasons: [...reasons] };
};

// Small related families stay in one job; broad work keeps the existing three-job cap.
export const componentShardCount = (files: string[]) => Math.min(3, Math.ceil(files.length / 5));
