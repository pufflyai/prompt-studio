export type { ManagedWebviewBuildInputs, ManagedWebviewBuildSourceResult } from "pstdio-extensions/authoring";
export { inspectManagedWebviewBuildInputs, prepareManagedWebviewBuildSource } from "pstdio-extensions/authoring";

import { extensionOwnersEnabled, prepareExtensionWork } from "pstdio-extensions";
import { inspectManagedWebviewBuildInputs, prepareManagedWebviewBuildSource } from "pstdio-extensions/authoring";

export const inspectWebviewInputsForHost = async (input: Parameters<typeof inspectManagedWebviewBuildInputs>[0]) =>
  extensionOwnersEnabled() ? prepareExtensionWork("inspectWebview", input) : inspectManagedWebviewBuildInputs(input);
export const prepareWebviewSourceForHost = async (
  input: Parameters<typeof prepareManagedWebviewBuildSource>[0],
  signal?: AbortSignal,
) =>
  extensionOwnersEnabled()
    ? prepareExtensionWork("prepareWebview", input, signal)
    : prepareManagedWebviewBuildSource(input);
