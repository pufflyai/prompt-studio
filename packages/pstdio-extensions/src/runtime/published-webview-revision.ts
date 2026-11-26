import { linkSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { preparedCacheRoot } from "./prepared-revision";

const revisionPath = (distDir: string) => join(dirname(distDir), "published-revision.txt");
const releaseReference = /^release:([a-f0-9]{64}):(0|[1-9]\d*):([a-f0-9]{64})$/;

// A release publication names immutable bytes. Older publications still live under dist.
export const readPublishedWebview = (distDir: string) => {
  let marker: string;
  try {
    marker = readFileSync(revisionPath(distDir), "utf8");
  } catch {
    return null;
  }
  if (!marker) return null;
  if (!marker.startsWith("release:")) return { distDir, revision: marker };
  const match = releaseReference.exec(marker);
  if (!match) return null;
  const [, releaseId, viewIndex, artifactId] = match;
  return {
    distDir: join(preparedCacheRoot(), "revisions", releaseId!, "webviews", viewIndex!),
    revision: `prepared:${artifactId}`,
  };
};

export const readPublishedWebviewRevision = (distDir: string) => readPublishedWebview(distDir)?.revision ?? null;

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

export const recordPublishedReleaseWebview = (
  distDir: string,
  releaseId: string,
  viewIndex: string,
  artifactId: string,
) => {
  const marker = `release:${releaseId}:${viewIndex}:${artifactId}`;
  if (!releaseReference.test(marker)) throw new Error("Invalid release webview reference.");
  writeRevision(distDir, marker, "replace");
};
