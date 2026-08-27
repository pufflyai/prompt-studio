import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { marketplaceExtensionRepositoryPath } from "./extension-marketplace";
import { type CommandOptions, type CommandResult, runCommand } from "./install-extension-dependencies";

export const PSTDIO_REPOSITORY_URL = "https://github.com/pufflyai/prompt-studio";

const cloneRepoSparse = async (
  checkoutPath: string,
  paths: string[],
  run: (command: string, args: string[], options: CommandOptions) => Promise<CommandResult>,
  ref?: string,
  signal?: AbortSignal,
) => {
  const tempParent = dirname(checkoutPath);
  const cloneArgs = ["clone", "--depth", "1", "--filter=blob:none", "--sparse"];
  if (ref) cloneArgs.push("--branch", ref);
  signal?.throwIfAborted();
  const clone = await run("git", [...cloneArgs, PSTDIO_REPOSITORY_URL, checkoutPath], {
    cwd: tempParent,
    ...(signal ? { signal } : {}),
  });
  if (clone.exitCode !== 0) {
    const detail = clone.stderr.trim() || clone.stdout.trim();
    throw new Error(`Failed to clone ${PSTDIO_REPOSITORY_URL}${ref ? ` at ${ref}` : ""}: ${detail}`);
  }

  signal?.throwIfAborted();
  const sparse = await run("git", ["sparse-checkout", "set", ...paths], {
    cwd: checkoutPath,
    ...(signal ? { signal } : {}),
  });
  if (sparse.exitCode !== 0) {
    throw new Error(`Failed to fetch ${paths.join(", ")}: ${sparse.stderr.trim() || sparse.stdout.trim()}`);
  }

  signal?.throwIfAborted();
  const head = await run("git", ["rev-parse", "HEAD"], {
    cwd: checkoutPath,
    ...(signal ? { signal } : {}),
  });
  signal?.throwIfAborted();
  if (head.exitCode !== 0) {
    throw new Error(`Failed to resolve the installed commit: ${head.stderr.trim() || head.stdout.trim()}`);
  }

  return head.stdout.trim();
};

export const namedSourceRef = (commit: string, name: string) =>
  `${PSTDIO_REPOSITORY_URL}@${commit}#${marketplaceExtensionRepositoryPath(name)}`;

export const prepareNamedSource = async (name: string, tempDir: string, ref?: string, signal?: AbortSignal) => {
  const checkoutPath = join(tempDir, "prompt-studio");
  const repositoryPath = marketplaceExtensionRepositoryPath(name);
  const commit = await cloneRepoSparse(checkoutPath, [repositoryPath], runCommand, ref, signal);
  return {
    path: join(checkoutPath, repositoryPath),
    ref: namedSourceRef(commit, name),
  };
};

export const createSharedNamedSourceCheckout = async (
  names: string[],
  options: {
    ref?: string;
    runCommand?: (command: string, args: string[], opts: CommandOptions) => Promise<CommandResult>;
    signal?: AbortSignal;
  } = {},
) => {
  const tempDir = mkdtempSync(join(tmpdir(), "pstdio-extension-shared-"));
  const cleanup = () => rmSync(tempDir, { recursive: true, force: true });

  if (names.length === 0) {
    return { prepareNamedSource, cleanup };
  }

  const checkoutPath = join(tempDir, "prompt-studio");
  let commit: string;
  try {
    commit = await cloneRepoSparse(
      checkoutPath,
      names.map(marketplaceExtensionRepositoryPath),
      options.runCommand ?? runCommand,
      options.ref,
      options.signal,
    );
  } catch (error) {
    cleanup();
    throw error;
  }

  const shared = async (name: string, _tempDir?: string, _ref?: string, signal?: AbortSignal) => {
    signal?.throwIfAborted();
    return {
      path: join(checkoutPath, marketplaceExtensionRepositoryPath(name)),
      ref: namedSourceRef(commit, name),
    };
  };

  return { prepareNamedSource: shared, cleanup };
};
