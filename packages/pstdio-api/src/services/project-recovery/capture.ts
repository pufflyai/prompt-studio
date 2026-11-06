import { createRecoveryFileCache } from "./file-cache";
import {
  captureRecoveryGitDependencies,
  isRecoveryGitAdministration,
  isRecoveryGitPath,
  isRecoveryGitPointer,
} from "./git-dependencies";
import { createRecoveryPolicy } from "./policy";
import { type RecoveryScanInput, scanRecoveryRoot } from "./scan";

export { RecoveryCaptureError } from "./scan";

/** Captures the project folder under its root policy, then the external Git
 * administration that registered repository roots allow it to depend on. */
export const captureRecoveryFolder = async (
  input: Omit<RecoveryScanInput, "policy" | "pointer" | "visited"> & { gitRoots?: string[] },
) => {
  let found = false;
  const excluded: string[] = [];
  const unsupported: string[] = [];
  const reuse = createRecoveryFileCache(input.chunks);
  const { rootPath, pointers, ...scan } = await scanRecoveryRoot({
    ...input,
    reuse,
    pointer: isRecoveryGitPointer,
    visited: (path, included, kind) => {
      const administration = isRecoveryGitAdministration(path);
      if (included) found ||= administration;
      else if (isRecoveryGitPath(path) && excluded.length < 64) excluded.push(path);
      // Only a `.git` directory or pointer file is Git administration; a link is not followed.
      if (included && administration && kind === "other" && unsupported.length < 64) unsupported.push(path);
    },
  });
  const policy = createRecoveryPolicy(scan.policy);
  const git = await captureRecoveryGitDependencies({
    root: rootPath,
    scan: { rootPath, pointers, ...scan },
    gitRoots: input.gitRoots ?? [],
    found,
    excluded,
    unsupported,
    included: (path) => policy.classify(path, true).included,
    signal: input.signal,
    capture: (root, text, pointer) =>
      scanRecoveryRoot({
        root,
        expectedRoot: root,
        chunks: input.chunks,
        policy: { text },
        pointer,
        reuse,
        signal: input.signal,
        progress: input.progress,
      }),
  });
  return { ...scan, git };
};
