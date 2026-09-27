# Temporary file-backed extension connection secrets

## Status

Accepted as a temporary development workaround.

## Intended design

Prompt Studio should store extension connection credentials in an operating-system keychain on desktop installations and in a deployment secret provider on hosted installations. The API should depend on a small secret-store interface. Extension code should receive only authenticated connection operations and should never read the secret value.

## External limitation

PS-294 does not select the supported desktop and deployment secret providers. The repository also has no cross-platform keychain dependency or deployment secret integration. Choosing one in this change would create a new platform policy outside the ticket's approved scope.

## Temporary workaround

The local host uses a file-backed secret store under its private storage root. It writes one credential per opaque reference with owner-only permissions where the operating system supports them. The database stores only the opaque reference. The API accepts an injected secret-store implementation so a production host can replace the file store.

## Trade-offs

The file store keeps credentials out of repositories, workspaces, extension settings, child processes, logs, and database rows. It does not provide the hardware or account-backed protection of an operating-system keychain. Anyone who can read the Prompt Studio host account's private storage can read the credentials.

## Isolation

Only the connection service imports the secret-store interface. Extension contexts expose named request and stream operations. They do not expose secret references or secret bytes. Tests use an in-memory implementation.

## Removal

Remove the file store after the platform owner selects the desktop and deployment secret providers. Implement those providers behind the same interface, migrate existing opaque references, and delete this ADR and the file-backed implementation after one release that can read and migrate local development credentials.
