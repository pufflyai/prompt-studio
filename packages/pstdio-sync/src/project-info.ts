import type * as Y from "yjs";

/** Core's synced description of a cloud project. A new device reads it before the project exists there. */
export const projectInfoDocumentId = "project-info";

export interface ProjectInfo {
  name?: string;
  /** The `origin` remote of the project's folder. A new device offers to clone it. */
  gitRemote?: string;
}

const info = (document: Y.Doc) => document.getMap<string>("project");

export const readProjectInfo = (document: Y.Doc) => {
  const map = info(document);
  return { name: map.get("name"), gitRemote: map.get("gitRemote") } satisfies ProjectInfo;
};

export const writeProjectInfo = (document: Y.Doc, next: ProjectInfo) => {
  const map = info(document);
  document.transact(() => {
    for (const key of ["name", "gitRemote"] as const) {
      const value = next[key];
      if (value === undefined) continue;
      if (map.get(key) !== value) map.set(key, value);
    }
  });
};
