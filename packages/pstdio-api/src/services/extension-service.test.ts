import { describe, expect, mock, test } from "bun:test";
import type { CheckExtensionsResult } from "pstdio-extensions";
import { createExtensionService } from "./extension-service";

const emptyResult = (overrides: Partial<CheckExtensionsResult> = {}): CheckExtensionsResult => ({
  homeRoot: "/tmp/home",
  extensionsRoot: "/tmp/home/extensions",
  extensionsRootExists: true,
  installedExtensionDirs: [],
  errorCount: 0,
  warningCount: 0,
  runtime: {
    extensions: [],
    commands: [],
    middlewares: [],
    hooks: [],
    cli: [],
    schedules: [],
    artifactMounts: [],
    views: [],
    routes: [],
    navigation: [],
    settingsPanels: [],
    templateTypes: [],
    templates: [],
    skills: [],
    harnesses: [],
    workspaceTypes: [],
    diagnostics: [],
  },
  ...overrides,
});

// biome-ignore lint/suspicious/noExplicitAny: opaque DB service stub for the unit test
const stubDbService = (): any => ({});

describe("extensionService.check", () => {
  test("delegates to the runtime check function", async () => {
    const result = emptyResult();
    const runCheck = mock(async () => result);
    const service = createExtensionService({
      installedExtensionSourcesDBService: stubDbService(),
      projectExtensionInstancesDBService: stubDbService(),
      extensionKvDBService: stubDbService(),
      extensionCollectionItemsDBService: stubDbService(),
      extensionTemplatePreferencesDBService: stubDbService(),
      extensionSkillPreferencesDBService: stubDbService(),
      runCheck,
    });

    const out = await service.check({ homeRoot: "/tmp/home" });

    expect(runCheck).toHaveBeenCalledWith({ homeRoot: "/tmp/home" });
    expect(out).toBe(result);
  });
});
