import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { deserialize, serialize } from "node:v8";
import { preparationHostIdentity, preparedCacheRoot } from "../prepared-revision";
import { BACKEND_PROTOCOL_VERSION } from "./protocol";

// Bump when the meaning of a reported definition changes.
const DEFINITION_FORMAT = `${BACKEND_PROTOCOL_VERSION}:1`;

export interface DefinitionRevision {
  id: string;
  host: string;
  entryPath: string;
}

interface CachedDefinition {
  format: string;
  revisionId: string;
  host: string;
  entryPath: string;
  definition: unknown;
}

/**
 * The definition lives in its prepared revision's folder, so it is keyed by revision id and
 * cache maintenance removes it together with the revision (ADR 0147).
 */
export const definitionCachePath = (revisionId: string) =>
  join(preparedCacheRoot(), "revisions", revisionId, "definition.bin");

/** Returns nothing unless the entry was written for exactly this revision, host and bundled entry. */
export const readCachedDefinition = (revision: DefinitionRevision) => {
  try {
    const cached = deserialize(readFileSync(definitionCachePath(revision.id))) as CachedDefinition;
    const trusted =
      cached.format === DEFINITION_FORMAT &&
      cached.revisionId === revision.id &&
      cached.host === revision.host &&
      cached.host === preparationHostIdentity() &&
      cached.entryPath === revision.entryPath;
    return trusted ? { definition: cached.definition } : undefined;
  } catch {
    return undefined;
  }
};

const removeDefinitionFile = (path: string) => {
  try {
    rmSync(path, { force: true });
  } catch {
    // Cache files may be unavailable. Always let the worker lifecycle finish.
  }
};

// A cache write never fails a load; the next load reads the definition again.
export const writeCachedDefinition = (revision: DefinitionRevision, definition: unknown) => {
  const path = definitionCachePath(revision.id);
  const staging = `${path}.${crypto.randomUUID()}.tmp`;
  try {
    mkdirSync(dirname(path), { recursive: true });
    const entry: CachedDefinition = {
      format: DEFINITION_FORMAT,
      revisionId: revision.id,
      host: revision.host,
      entryPath: revision.entryPath,
      definition,
    };
    writeFileSync(staging, serialize(entry));
    renameSync(staging, path);
  } catch {
    removeDefinitionFile(staging);
  }
};

export const forgetCachedDefinition = (revisionId: string) => removeDefinitionFile(definitionCachePath(revisionId));

/**
 * Identifies everything a definition reports, handler ids included. A worker started later must
 * report the same definition, or the handler ids the host holds could run other functions.
 */
export const definitionDigest = (definition: unknown) =>
  createHash("sha256").update(serialize(definition)).digest("hex");
