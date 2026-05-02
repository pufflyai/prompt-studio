import type {
  createExtensionCollectionItemsDBService,
  createExtensionKvDBService,
  createExtensionSkillPreferencesDBService,
  createExtensionTemplatePreferencesDBService,
  createInstalledExtensionSourcesDBService,
  createProjectExtensionInstancesDBService,
} from "pstdio-db";
import { type CheckExtensionsInput, type CheckExtensionsResult, checkExtensions } from "pstdio-extensions";

export type ExtensionServiceDeps = {
  installedExtensionSourcesDBService: ReturnType<typeof createInstalledExtensionSourcesDBService>;
  projectExtensionInstancesDBService: ReturnType<typeof createProjectExtensionInstancesDBService>;
  extensionKvDBService: ReturnType<typeof createExtensionKvDBService>;
  extensionCollectionItemsDBService: ReturnType<typeof createExtensionCollectionItemsDBService>;
  extensionTemplatePreferencesDBService: ReturnType<typeof createExtensionTemplatePreferencesDBService>;
  extensionSkillPreferencesDBService: ReturnType<typeof createExtensionSkillPreferencesDBService>;
  /** Override how the runtime check is invoked. Defaults to the real runtime. */
  runCheck?: (input: CheckExtensionsInput) => Promise<CheckExtensionsResult>;
};

export const createExtensionService = (deps: ExtensionServiceDeps) => {
  const runCheck = deps.runCheck ?? checkExtensions;

  return {
    check: (input: CheckExtensionsInput = {}) => runCheck(input),
    ...deps.installedExtensionSourcesDBService,
    ...deps.projectExtensionInstancesDBService,
    ...deps.extensionKvDBService,
    ...deps.extensionCollectionItemsDBService,
    ...deps.extensionTemplatePreferencesDBService,
    ...deps.extensionSkillPreferencesDBService,
  };
};

export type ExtensionService = ReturnType<typeof createExtensionService>;
