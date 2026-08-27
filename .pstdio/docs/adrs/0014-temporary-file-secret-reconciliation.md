# Temporary reconciliation for file-backed connection secrets

## Status

Accepted as a temporary development workaround.

## Intended design

Connection metadata and its credential should share one transactional secret provider. Removing the database owner should remove the credential in the same commit. A failed commit should leave both unchanged.

## External limitation

The temporary file-backed secret store from ADR 0013 is outside PGlite transactions. The filesystem and PGlite cannot commit or roll back one atomic operation. A process can also stop between their separate writes.

## Temporary workaround

The database is the source of truth for credential ownership. Removal commits the database row first and then attempts to delete the secret file. Cleanup errors do not change the result of a committed extension or project deletion. At startup, the connection service removes rows owned by uninstalled extensions and deletes secret files that have no database reference.

## Trade-offs

Failed cleanup can leave an unread orphan file until the next startup. The credential is no longer reachable through the extension API because its database owner is gone. Startup performs extra database and directory reads and retries each cleanup operation independently.

## Isolation

Only the connection service and the file-backed secret store know about reconciliation. Other extension services continue to use named connections and opaque secret references. Cleanup failures are logged with no credential values.

## Removal

Remove this reconciliation when ADR 0013 is removed and every supported secret provider can commit credential ownership with the application database or provide its own durable deletion queue. Delete this ADR, the secret listing method, and the startup reconciliation call together.
