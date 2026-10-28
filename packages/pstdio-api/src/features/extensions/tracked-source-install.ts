import { basename } from "node:path";
import type { ExtensionInstallations } from "../../services/extension-installations";
import { packagedExtensionCatalog } from "./extension-catalog";
import { type InstallExtensionSourceInput, installExtensionSource } from "./install-extension-source";

export const trackedSourceInstaller = (jobs: ExtensionInstallations) => (input: InstallExtensionSourceInput) => {
  const installName = input.installName ?? basename(input.source);
  const entry = packagedExtensionCatalog.extensions.find((entry) => entry.installName === installName);
  return jobs.run(
    { installName, displayName: entry?.displayName ?? installName, extensionId: entry?.extensionId },
    (signal) =>
      installExtensionSource({ ...input, signal: input.signal ? AbortSignal.any([signal, input.signal]) : signal }),
  );
};
