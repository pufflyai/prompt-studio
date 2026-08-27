import type { ExtensionsCheckResponse } from "pstdio-api-contracts";
import type { ExtensionMetadata } from "./extension-runtime";
import type { CommandOptions, CommandResult } from "./install-extension-dependencies";

export type InstallExtensionSourceInput = {
  /** Keep a managed source installed so the dashboard can repair it after an extension API change. */
  allowUnsupportedApiVersion?: boolean;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  existsOk?: boolean;
  force?: boolean;
  homedir?: () => string;
  installName?: string;
  repoPath?: string;
  isPackagedRuntime?: () => boolean;
  bunCacheDir?: string;
  prepareNamedSource?: (
    name: string,
    tempDir: string,
    ref?: string,
    signal?: AbortSignal,
  ) => Promise<{ path: string; ref: string }>;
  /** Git ref for a named source. Omitting it takes the default branch, which only development does. */
  ref?: string;
  processExecPath?: string;
  reuseInstalledDependencies?: boolean;
  runCommand?: (command: string, args: string[], options: CommandOptions) => Promise<CommandResult>;
  saveLockfile?: boolean;
  skipInstall?: boolean;
  signal?: AbortSignal;
  source: string;
};

export type InstalledExtensionSource = {
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
};

export type ExtensionEnableInput = {
  displayName: string;
  extensionId: string;
  manifest: Record<string, unknown>;
  name: string;
  sourceHash: string;
  sourceKind: "git" | "local_path";
  sourcePath: string;
  sourceRef: string | null;
  version: string | null;
};
