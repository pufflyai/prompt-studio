import {
  captureRecoveryGitDependencies,
  isRecoveryGitAdministration,
  isRecoveryGitPath,
  isRecoveryGitPointer,
} from "./git-dependencies";
import { type RecoveryScanInput, scanRecoveryRoot } from "./scan";

export { RecoveryCaptureError } from "./scan";

/** Captures the project folder under its root policy, then the external Git
 * administration that registered repository roots allow it to depend on. */
export const captureRecoveryFolder = async (
  input: Omit<RecoveryScanInput, "policy" | "pointer" | "visited"> & { gitRoots?: string[] },
) => {
  let found = false;
  const excluded: string[] = [];
  const { rootPath, pointers, ...scan } = await scanRecoveryRoot({
    ...input,
    pointer: isRecoveryGitPointer,
    visited: (path, included) => {
      if (included) found ||= isRecoveryGitAdministration(path);
      else if (isRecoveryGitPath(path) && excluded.length < 64) excluded.push(path);
    },
  });
  const git = await captureRecoveryGitDependencies({
    root: rootPath,
    scan: { rootPath, pointers, ...scan },
    gitRoots: input.gitRoots ?? [],
    found,
    excluded,
    signal: input.signal,
    capture: (root, policy, pointer) =>
      scanRecoveryRoot({ root, chunks: input.chunks, policy: { text: policy }, pointer, signal: input.signal }),
  });
  return { ...scan, git };
};
