import type { ExtensionsCheckResponse } from "pstdio-api-contracts";
import type { PreparedExtensionRevision } from "pstdio-extensions";
import type { GitExtensionOrigin } from "./extension-catalog";
import type { ExtensionInstallTransaction } from "./extension-install-transaction";
import type { ExtensionMetadata } from "./extension-runtime";
import type { CommandOptions, CommandResult } from "./install-extension-dependencies";

export type InstallExtensionSourceInput = {
  /** Keep a managed source installed so the dashboard can repair it after an extension API change. */
  allowUnsupportedApiVersion?: boolean;
  retainBackup?: boolean;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  existsOk?: boolean;
  force?: boolean;
  homedir?: () => string;
  installName?: string;
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
  ) => Promise<{ path: string; ref: string }>;
  /** Git ref for a named source. Omitting it takes the default branch, which only development does. */
  ref?: string;
  processExecPath?: string;
  reuseInstalledDependencies?: boolean;
  runCommand?: (command: string, args: string[], options: CommandOptions) => Promise<CommandResult>;
  skipInstall?: boolean;
  signal?: AbortSignal;
  preparedSource?: { path: string; ref: string };
  originSource?: { kind: "git" | "release"; origin: GitExtensionOrigin };
  registrySource?: { url: string; id: string };
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
