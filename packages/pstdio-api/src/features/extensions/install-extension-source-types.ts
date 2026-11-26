import type { ExtensionsCheckResponse } from "pstdio-api-contracts";
import type { PreparedExtensionRevision } from "pstdio-extensions";
import type { RegistryRelease } from "pstdio-extensions/distribution";
import type { GitExtensionOrigin } from "./extension-catalog";
import type { ExtensionInstallTransaction } from "./extension-install-transaction";
import type { ExtensionMetadata } from "./extension-runtime";
import type { CommandOptions, CommandResult } from "./install-extension-dependencies";

export type PreparedNamedInstallSource = {
  path: string;
  ref: string;
  /** The selector used for the Git checkout. The stored source ref contains the resolved commit. */
  gitRef?: string;
};

export type InstallExtensionSourceInput = {
  /** Keep a managed source installed so the dashboard can repair it after an extension API change. */
  allowUnsupportedApiVersion?: boolean;
  retainBackup?: boolean;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  existsOk?: boolean;
  force?: boolean;
  homedir?: () => string;
  installName?: string;
  /** Existing instance selected for a release upgrade. */
  installedSourcePath?: string;
  /** An Upgrade action may refresh the same version or replace it with a newer one. */
  upgradeFromVersion?: string | null;
  /** Worker-inspected owner whose destination family was reserved before preparation. */
  expectedIdentity?: string;
  /** The batch can share source reads while retaining exclusive destination ownership. */
  reservation?: { reads: readonly string[]; writes: readonly string[] };
  /** Running host release used by catalog origins whose ref is `{hostRelease}`. */
  hostReleaseRef?: string;
  repoPath?: string;
  /** Where the source is installed. Defaults to the scope its manifest declares. */
  scope?: "repo" | "user";
  isPackagedRuntime?: () => boolean;
  bunCacheDir?: string;
  prepareNamedSource?: (
    name: string,
    tempDir: string,
    ref?: string,
    signal?: AbortSignal,
    hostReleaseRef?: string,
  ) => Promise<PreparedNamedInstallSource>;
  /** Git ref for a named source. Omitting it takes the default branch, which only development does. */
  ref?: string;
  processExecPath?: string;
  reuseInstalledDependencies?: boolean;
  runCommand?: (command: string, args: string[], options: CommandOptions) => Promise<CommandResult>;
  skipInstall?: boolean;
  signal?: AbortSignal;
  preparedSource?: PreparedNamedInstallSource;
  originSource?: { kind: "git" | "release"; origin: GitExtensionOrigin };
  registrySource?: { url: string; id: string; release?: RegistryRelease };
  source: string;
};

export type InstalledExtensionSource = {
  installation?: ExtensionInstallTransaction;
  check: ExtensionsCheckResponse;
  installName: string;
  manifest: Record<string, unknown>;
  metadata: ExtensionMetadata;
  source:
    | { kind: "local"; path: string; ref?: string }
    | {
        kind: "named";
        name: string;
        ref: string;
      };
  sourceHash: string;
  targetPath: string;
  preparedRevision?: PreparedExtensionRevision;
};

export type ExtensionEnableInput = {
  installation?: ExtensionInstallTransaction;
  preparedRevision?: PreparedExtensionRevision;
  displayName: string;
  extensionId: string;
  manifest: Record<string, unknown>;
  name: string;
  sourceHash: string;
  sourceKind: "git" | "local_path" | "registry";
  sourcePath: string;
  sourceRef: string | null;
  version: string | null;
};
