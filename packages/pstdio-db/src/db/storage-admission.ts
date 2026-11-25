import { canonicalExtensionId } from "pstdio-api-contracts/extension-host";
import type { StorageOwner } from "pstdio-sync";

// Admission reconstructs this set from retained migration inputs on every open.
// It gates unavailable owners without querying historical tables during requests.
const unavailable = new WeakMap<object, Map<string, { owner: StorageOwner; error: Error }>>();
const key = (owner: StorageOwner) => JSON.stringify([owner.workbenchId, canonicalExtensionId(owner.extensionId)]);

export const retainUnadmittedOwner = (db: object, owner: StorageOwner, cause: unknown) => {
  const owners = unavailable.get(db) ?? new Map();
  owners.set(key(owner), {
    owner,
    error: new Error("This owner's data is unavailable until its storage upgrade can preserve its recovery input", {
      cause,
    }),
  });
  unavailable.set(db, owners);
};

export const assertStorageOwnerAdmitted = (db: object, owner: StorageOwner) => {
  const blocked = unavailable.get(db)?.get(key(owner));
  if (blocked) throw blocked.error;
};

export const storageOwnerAdmissionPending = (db: object, owner: StorageOwner) =>
  unavailable.get(db)?.has(key(owner)) ?? false;

export const storageProjectAdmissionPending = (db: object, projectId: string) =>
  [...(unavailable.get(db)?.values() ?? [])].some(({ owner }) => owner.workbenchId === projectId);

export const assertStorageProjectAdmitted = (db: object, projectId: string) => {
  for (const { owner, error } of unavailable.get(db)?.values() ?? []) if (owner.workbenchId === projectId) throw error;
};

export const unadmittedExtensionProjects = (db: object, extensionId: string) =>
  [...(unavailable.get(db)?.values() ?? [])]
    .filter(({ owner }) => canonicalExtensionId(owner.extensionId) === canonicalExtensionId(extensionId))
    .map(({ owner }) => owner.workbenchId);

export const unadmittedStorageOwners = (db: object) =>
  [...(unavailable.get(db)?.values() ?? [])].map(({ owner }) => owner);

/** Startup decisions are also needed by the API handle when PGlite owns the database in a worker. */
export const unadmittedStorageOwnerFailures = (db: object) =>
  [...(unavailable.get(db)?.values() ?? [])].map(({ owner, error }) => ({ owner, cause: error.cause }));
