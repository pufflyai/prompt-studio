import { beforeEach, describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { createWorkbenchCore } from "pstdio-workbench/core";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardResources } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { createCommandPaletteModule } from "./modules/command-palette/module";
import { createDashboardViewsModule } from "./modules/dashboard-views/module";
import { createHeadersModule } from "./modules/headers/module";
import { createHelpModule } from "./modules/help/module";
import { createKeyboardShortcutsModule } from "./modules/keyboard-shortcuts/module";
import { createDashboardProjects } from "./modules/projects/data/project-data";
import { createProjectsModule } from "./modules/projects/module";
import { createSettingsModule } from "./modules/settings/module";
import { createWorkspacesModule } from "./modules/workspaces/module";
import { seedDashboardWorkbenchRows } from "./test-utils/dashboard-data-fixture";

const workbenchRoot = import.meta.dir;
const modulesRoot = join(import.meta.dir, "modules");
const retiredDataRoot = join(import.meta.dir, "data");
const featureNames = [
  "command-palette",
  "dashboard-views",
  "extensions",
  "headers",
  "help",
  "keyboard-shortcuts",
  "projects",
  "session-bubble",
  "sessions",
  "settings",
  "workspaces",
];

const listSourceFiles = (dir: string): string[] => {
  if (!existsSync(dir)) return [];

  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(dir, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      files.push(...listSourceFiles(path));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry)) continue;
    if (entry.includes(".test.")) continue;
    files.push(path);
  }

  return files;
};

const listTopLevelDataImports = (file: string) => {
  const source = readFileSync(file, "utf8");
  const imports = [...source.matchAll(/\bfrom\s+["']([^"']+)["']/g)];

  return imports
    .map((match) => match[1])
    .filter((specifier): specifier is string => Boolean(specifier?.startsWith(".")))
    .map((specifier) => resolve(dirname(file), specifier))
    .filter((resolvedImport) => resolvedImport.startsWith(`${retiredDataRoot}/`));
};

const listFeatureModuleImports = (file: string) => {
  const relativeFile = relative(modulesRoot, file);
  const [sourceFeaturePath] = relativeFile.split("/");
  const sourceFeature = sourceFeaturePath?.replace(/\.(ts|tsx)$/, "");
  const source = readFileSync(file, "utf8");
  const imports = [...source.matchAll(/\bfrom\s+["']([^"']+)["']/g)];

  return imports
    .map((match) => match[1])
    .filter((specifier): specifier is string => Boolean(specifier?.startsWith(".")))
    .map((specifier) => resolve(dirname(file), specifier))
    .filter((resolvedImport) => resolvedImport.startsWith(`${modulesRoot}/`))
    .map((resolvedImport) => relative(modulesRoot, resolvedImport).split("/")[0])
    .filter((targetFeature): targetFeature is string => Boolean(targetFeature))
    .filter((targetFeature) => featureNames.includes(targetFeature) && targetFeature !== sourceFeature)
    .map((targetFeature) => `${relativeFile} -> ${targetFeature}`);
};

beforeEach(() => {
  seedDashboardWorkbenchRows();
});

describe("dashboard workbench module isolation", () => {
  test("opens the workspace board without registering the sessions module", async () => {
    const workbench = createWorkbenchCore();
    workbench.registerModule(createDashboardViewsModule());
    workbench.registerModule(createProjectsModule());
    workbench.registerModule(createCommandPaletteModule());
    workbench.registerModule(createWorkspacesModule());

    const project = createDashboardProjects().find((entry) => entry.id === "project-1");
    expect(project).toBeDefined();

    await expect(workbench.resources.openResource(project!.resource, { replaceActive: true })).resolves.toBeDefined();

    expect(workbench.modes.getActiveModeId()).toBe("project");
    expect(workbench.layout.getLayout().areas.main.widgets.map((placement) => placement.contributionId)).toEqual([
      dashboardWidgetIds.workspaces,
    ]);
  });

  test("opens settings without registering the sessions module", async () => {
    const workbench = createWorkbenchCore();
    workbench.registerModule(createCommandPaletteModule());
    workbench.registerModule(createSettingsModule());

    const project = createDashboardProjects().find((entry) => entry.id === "project-1");
    expect(project).toBeDefined();
    selectDashboardProject(workbench, project!);

    await expect(
      workbench.resources.openResource(dashboardResources.settings, { replaceActive: true }),
    ).resolves.toBeDefined();

    expect(workbench.modes.getActiveModeId()).toBe("settings");
    expect(workbench.layout.getLayout().areas.main.widgets.map((placement) => placement.contributionId)).toEqual([
      dashboardWidgetIds.settings,
    ]);
  });

  test("small app-frame modules register independently", () => {
    const workbench = createWorkbenchCore();

    workbench.registerModule(createDashboardViewsModule());
    workbench.registerModule(createHeadersModule());
    workbench.registerModule(createKeyboardShortcutsModule());
    workbench.registerModule(createHelpModule());
    workbench.registerModule(createCommandPaletteModule());

    expect(workbench.layout.getWidget(dashboardWidgetIds.header)).toBeDefined();
    expect(workbench.layout.getWidget(dashboardWidgetIds.leftHeader)).toBeDefined();
    expect(workbench.layout.getWidget(dashboardWidgetIds.shortcutHelp)).toBeDefined();
    expect(workbench.commands.getCommand("dashboard.openCommandPalette")).toBeDefined();
    expect(workbench.commands.getCommand("dashboard.openShortcuts")).toBeDefined();
    expect(workbench.commands.getCommand("dashboard.openDocs")).toBeDefined();
  });

  test("dashboard view listing only includes registered feature views", () => {
    const workbench = createWorkbenchCore();
    workbench.registerModule(createDashboardViewsModule());
    workbench.registerModule(createWorkspacesModule());

    expect(
      workbench.resources
        .listResources("")
        .filter((entry) => entry.resource.kind === "dashboard-view")
        .map((entry) => entry.resource),
    ).toEqual([dashboardResources.workspaces]);
  });

  test("feature module source does not import another feature module implementation", () => {
    const violations = listSourceFiles(modulesRoot).flatMap(listFeatureModuleImports);

    expect(violations).toEqual([]);
  });

  test("workbench source does not use the retired top-level data module", () => {
    const importViolations = listSourceFiles(workbenchRoot).flatMap((file) =>
      listTopLevelDataImports(file).map(
        (resolvedImport) => `${relative(workbenchRoot, file)} -> ${relative(workbenchRoot, resolvedImport)}`,
      ),
    );
    const retiredSources = listSourceFiles(retiredDataRoot).map(
      (file) => `retired source: ${relative(workbenchRoot, file)}`,
    );

    expect([...importViolations, ...retiredSources]).toEqual([]);
  });
});
