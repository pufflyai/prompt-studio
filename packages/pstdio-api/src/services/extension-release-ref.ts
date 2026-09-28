import { runCommand } from "../features/extensions/install-extension-dependencies";

const gitCommitPattern = /^[0-9a-f]{40}$/i;

export const parseExtensionSourceRef = (sourceRef: string | null) => {
  if (!sourceRef) return null;
  const pathSeparator = sourceRef.lastIndexOf("#");
  const commitSeparator = sourceRef.lastIndexOf("@", pathSeparator);
  if (pathSeparator < 1 || commitSeparator < 1) return null;
  const commit = sourceRef.slice(commitSeparator + 1, pathSeparator);
  const path = sourceRef.slice(pathSeparator + 1);
  const url = sourceRef.slice(0, commitSeparator);
  if (!url || !path || !gitCommitPattern.test(commit)) return null;
  return { commit: commit.toLowerCase(), path, url };
};

export const resolveExtensionReleaseCommit = async (originUrl: string, releaseRef: string, run = runCommand) => {
  if (gitCommitPattern.test(releaseRef)) return releaseRef.toLowerCase();

  const tagRef = releaseRef.startsWith("refs/") ? releaseRef : `refs/tags/${releaseRef}`;
  const branchRef = releaseRef.startsWith("refs/") ? null : `refs/heads/${releaseRef}`;
  const refs = [`${tagRef}^{}`, tagRef, ...(branchRef ? [branchRef] : [])];
  const result = await run("git", ["ls-remote", originUrl, ...refs], { cwd: process.cwd() });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || `Could not resolve ${releaseRef}`);
  }

  const commits = new Map(
    result.stdout
      .trim()
      .split("\n")
      .map((line) => line.split("\t", 2))
      .filter((entry): entry is [string, string] => entry.length === 2)
      .map(([commit, ref]) => [ref, commit]),
  );
  const commit = refs.map((ref) => commits.get(ref)).find(Boolean);
  if (!commit || !gitCommitPattern.test(commit)) throw new Error(`Could not resolve ${releaseRef}`);
  return commit.toLowerCase();
};
