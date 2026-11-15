import { linkSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const revisionPath = (distDir: string) => join(dirname(distDir), "published-revision.txt");

// The marker survives staging/replacement of dist and changes only after publication.
export const readPublishedWebviewRevision = (distDir: string) => {
  try {
    return readFileSync(revisionPath(distDir), "utf8") || null;
  } catch {
    return null;
  }
};

const writeRevision = (distDir: string, revision: string, mode: "initialize" | "replace") => {
  const target = revisionPath(distDir);
  const temporary = `${target}.tmp-${crypto.randomUUID()}`;
  try {
    writeFileSync(temporary, revision);
    if (mode === "replace") renameSync(temporary, target);
    else {
      try {
        // Linking complete bytes is exclusive: an established publication wins.
        linkSync(temporary, target);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
    }
  } finally {
    rmSync(temporary, { force: true });
  }
};
export const recordPublishedWebviewRevision = (distDir: string, revision: string) =>
  writeRevision(distDir, revision, "replace");
export const initializePublishedWebviewRevision = (distDir: string, revision: string) =>
  writeRevision(distDir, revision, "initialize");
