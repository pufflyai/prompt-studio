import {
  gitCommitPattern,
  isExtensionSourceUrl,
  resolveExtensionRepositoryRef,
} from "../features/extensions/extension-repository";

export const parseExtensionSourceRef = (sourceRef: string | null) => {
  if (!sourceRef) return null;
  const pathSeparator = sourceRef.lastIndexOf("#");
  const commitSeparator = sourceRef.lastIndexOf("@", pathSeparator);
  if (pathSeparator < 1 || commitSeparator < 1) return null;
  const commit = sourceRef.slice(commitSeparator + 1, pathSeparator);
  const path = sourceRef.slice(pathSeparator + 1);
  const url = sourceRef.slice(0, commitSeparator);
  // Stored refs must use the same allowed origins as installs.
  if (!isExtensionSourceUrl(url) || !path || !gitCommitPattern.test(commit)) return null;
  return { commit: commit.toLowerCase(), path, url };
};

export const resolveExtensionReleaseCommit = resolveExtensionRepositoryRef;
