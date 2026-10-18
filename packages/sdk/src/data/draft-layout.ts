import type { ArtifactMount } from "pstdio-api-contracts/extension-kernel";

export const assertSafePathSegment = (value: string) => {
  if (!value || value === "." || value === ".." || /[/\\\0]/.test(value))
    throw new Error(`Unsafe path segment: ${value}`);
};

/** @deprecated Use the named file handle from the extension file API (PRD 0009). Removed in 0.45 after Planner and Reports adopt that API. */
export const requireRepoFiles = (projectFiles: ArtifactMount | undefined) => {
  if (!projectFiles) throw new Error("This command must be run inside a project folder.");
  return projectFiles;
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
