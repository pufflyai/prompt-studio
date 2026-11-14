import { readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { Target } from "./test-plan";

const primary = ["linux-x64", "darwin-arm64", "win32-x64"];
const all = [...primary, "linux-arm64", "darwin-x64", "win32-arm64"];
const artifactCli = new Set([
  "npm-entrypoint",
  "packaged-assets-smoke",
  "extension-dependency-loading",
  "packaged-native-terminal",
  "packaged-artifact-lifecycle",
]);
// Mixed lifecycle, extraction, filesystem sync and install cases retain native execution.
// Narrowing these files requires extracting and qualifying the native replacement first.
const nativeCli = new Set([
  "extension-smoke",
  "packaged-linked-webview-smoke",
  "packaged-linked-dependency-smoke",
  "codex-transport",
  "runtime-lifecycle",
  "packaged-runtime-autostart",
  "extension-browser-install",
  "harness-npm-detection",
  "harness-native-probe-fixture",
  "packaged-workspace-cleanup-smoke",
  "packaged-harness-cleanup-smoke",
  "packaged-local-workspace-provider",
  "packaged-database-maintenance",
  "packaged-database-retirement",
  "packaged-storage-migration-smoke",
  "packaged-artifact-watch-limit",
  "packaged-project-setup-smoke",
  "packaged-core-extensions-smoke",
  "packaged-folder-recovery",
  "packaged-document-sync-smoke",
  "packaged-two-device-sync-smoke",
  "packaged-cloud-project-recovery",
]);
const sharedDesktop = new Set([
  "packaged-navigation-customization",
  "packaged-project-tab-order",
  "packaged-benchmark-evidence",
  "packaged-startup-evidence",
  "desktop-theme",
  "desktop-performance-capture",
  "desktop-visible-element-timing",
]);
const desktopReasons: Record<string, string> = {
  "packaged-app": "Native launch, authenticated sidecar, extension load, ownership and warm relaunch",
  "packaged-active-work": "Native quit with a live terminal and real shell signals",
  "packaged-attached-recovery": "Native backend ownership and process shutdown",
  "packaged-detached-process": "Detached process survival across native shutdown",
  "packaged-folder-picker": "Windows drive-letter selection through the native picker",
  "packaged-harness-detection": "GUI-launched shell and environment discovery",
  "packaged-project-tabs": "Mixed native title-bar/fullscreen, terminal and quit contracts retained until split",
  "packaged-performance-monitoring": "Mixed Windows PATH/system-tool and monitoring contracts retained until split",
  "packaged-update-channel": "Native channel integration, including Windows stable-only behavior",
  "packaged-database-recovery": "Native database ownership, locking and recovery",
  "packaged-startup-recovery": "Native process ownership and interrupted startup",
  "packaged-runtime-bind": "Native runtime port exclusion",
  "desktop-active-work": "Source-only native terminal shutdown contract",
  "desktop-app": "Source-only Electron startup and transport contracts",
  "desktop-external-links": "Native external URL handoff",
  "desktop-title-bar-geometry": "Native title-bar and window-control geometry",
  "desktop-window-readiness": "Native window readiness",
};
const coreOwners = [
  "@pstdio/sdk",
  "pstdio-api-contracts",
  "pstdio-db",
  "pstdio-extensions",
  "pstdio-paths",
  "pstdio-wt",
  "@pstdio/desktop",
  "pstdio-dashboard",
  "@pstdio/ui",
  "@pstdio/workbench",
  "pstdio-api",
  "pstdio",
];

export const integrationCoverage = (file: string) => {
  const name = file
    .split("/")
    .at(-1)!
    .replace(/\.p[0-3]\.(test|spec)\.tsx?$/, "");
  const desktop = file.startsWith("clients/desktop/src/e2e/") && file.endsWith(".spec.ts");
  let targets = ["linux-x64"];
  let surface = desktop ? "shared-desktop" : "shared-runtime";
  let reason = "Shared behavior has one Linux owner; existing Linux assertions are retained";
  if (artifactCli.has(name)) {
    targets = all;
    surface = "cli-artifact";
    reason = "Each shipped binary must load its own embedded runtime and native dependencies";
  } else if (nativeCli.has(name)) {
    targets = primary;
    surface = "native-runtime";
    reason =
      "Mixed native process/filesystem/install assertions retained on primary OS hosts until qualified extraction";
  } else if (desktop && !sharedDesktop.has(name) && name !== "desktop-runtime-descriptors") {
    targets = primary;
    surface = "native-desktop";
    reason = desktopReasons[name] ?? "Unclassified existing desktop contract retains native coverage pending review";
    if (name === "packaged-app") targets = [...primary, "darwin-x64"];
    if (name === "packaged-folder-picker") targets = ["win32-x64"];
  } else if (name === "packaged-webview-browsers") {
    surface = "browser-engine";
    reason = "Chromium, Firefox and WebKit prove actual browser origins, authentication and opaque iframe isolation";
  }
  const owners = [...coreOwners];
  if (/(?:^|-)(?:planner|board)(?:-|$)/.test(name)) owners.push("pstdio-planner");
  if (/notes|document|text/.test(name)) owners.push("pstdio-notes", "pstdio-storage");
  if (/cloud|sync|account|login|device|remote/.test(name))
    owners.push("pstdio-cloud", "pstdio-relay", "pstdio-account-manager");
  if (/session|chat|harness|codex|claude/.test(name))
    owners.push("pstdio-session-browser", "harness-codex", "harness-claude-code");
  if (/canvas|artifact/.test(name)) owners.push("ui-canvas", "pstdio-artifacts");
  return { surface, targets, reason, owners, smoke: name === "packaged-app" };
};

// Follow relative fixture/helper imports as well as production owners. A helper edit must
// select its consumers even when their test files and package manifests did not change.
const consumesChangedInput = (
  file: string,
  changed: Set<string>,
  root: string,
  visited = new Set<string>(),
): boolean => {
  if (changed.has(file)) return true;
  if (visited.has(file) || !statSync(join(root, file), { throwIfNoEntry: false })?.isFile()) return false;
  visited.add(file);
  const source = readFileSync(join(root, file), "utf8");
  for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)["'](\.[^"']+)["']/g)) {
    const base = join(dirname(file), match[1]!).replaceAll("\\", "/");
    const dependency = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find((path) =>
      statSync(join(root, path), { throwIfNoEntry: false })?.isFile(),
    );
    if (dependency && consumesChangedInput(dependency, changed, root, visited)) return true;
  }
  return false;
};

export const selectIntegrationFiles = (
  files: string[],
  target: Target,
  affected?: { changed: string[]; owners: string[]; root?: string },
) =>
  files.filter((file) => {
    const rule = integrationCoverage(file);
    if (!rule.targets.includes(`${target.platform}-${target.arch}`)) return false;
    if (!affected || rule.smoke) return true;
    if (rule.owners.some((owner) => affected.owners.includes(owner))) return true;
    return consumesChangedInput(file, new Set(affected.changed), affected.root ?? resolve(import.meta.dir, "../.."));
  });
