import { createCommandEnvironment } from "../features/extensions/command-environment";
import { createTestExtensionProcessOwners } from "./create-test-extension-process-owners";
import { createTestLocalAccount } from "./create-test-local-account";

type EnvironmentParameters = Parameters<typeof createCommandEnvironment>;

export const createTestCommandEnvironment = (
  deps: Omit<EnvironmentParameters[0], "extensionProcessOwners">,
  enabledSources: EnvironmentParameters[1],
  input: EnvironmentParameters[2],
  overrides?: EnvironmentParameters[3],
) =>
  createCommandEnvironment(
    {
      ...deps,
      accountService: Object.assign(createTestLocalAccount(), deps.accountService),
      extensionProcessOwners: createTestExtensionProcessOwners(() => enabledSources),
    },
    enabledSources,
    input,
    overrides,
  );
