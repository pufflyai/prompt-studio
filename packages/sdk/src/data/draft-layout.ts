import type { ArtifactMount } from "pstdio-api-contracts/extension-kernel";

export const assertSafePathSegment = (value: string) => {
  if (!value || value === "." || value === ".." || /[/\\\0]/.test(value))
    throw new Error(`Unsafe path segment: ${value}`);
};

export const requireRepoFiles = (repoFiles: ArtifactMount | undefined) => {
  if (!repoFiles) throw new Error("This command must be run inside a project repository.");
  return repoFiles;
};

export const createDraftLayout = (root: string, document: string) => {
  const directory = (name: string) => {
    assertSafePathSegment(name);
    return `${root}/${name}`;
  };
  return {
    directory,
    markdown: (name: string, suffix = "") => `${directory(name)}/${document}${suffix}.md`,
    files: (name: string, suffix = "") => `${directory(name)}/files${suffix}`,
  };
};
