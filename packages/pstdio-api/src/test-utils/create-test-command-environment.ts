import { createCommandEnvironment } from "../features/extensions/command-environment";
import { createTestExtensionProcessOwners } from "./create-test-extension-process-owners";

type EnvironmentParameters = Parameters<typeof createCommandEnvironment>;

export const createTestCommandEnvironment = (
  deps: Omit<EnvironmentParameters[0], "extensionProcessOwners">,
  enabledSources: EnvironmentParameters[1],
  input: EnvironmentParameters[2],
  overrides?: EnvironmentParameters[3],
) =>
  createCommandEnvironment(
    { ...deps, extensionProcessOwners: createTestExtensionProcessOwners(() => enabledSources) },
    enabledSources,
    input,
    overrides,
  );
