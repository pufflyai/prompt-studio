# Temporary file-backed extension connection secrets

Proposed: 2026-08-27

## Status

Accepted as a temporary workaround. This is the shipped behavior: every desktop and `pst serve` install stores connection secrets in files. No production host injects another store. Corrected on 2026-10-06 (PS-503) to say so and to remove an isolation claim the runtime does not enforce.

Owner: Aurélien Franky (maintainer). Removal target: 2027-01-31, tracked in PS-527.

## Intended design

Prompt Studio should store extension connection credentials in an operating-system keychain on desktop installations and in a deployment secret provider on hosted installations. The API should depend on a small secret-store interface. Extension code should receive only authenticated connection operations and should never be able to read the secret value.

## External limitation

PS-294 did not select the supported desktop and deployment secret providers, and the repository had no cross-platform keychain dependency or deployment secret integration.

The desktop half of this limitation no longer holds. The pinned Bun release has `Bun.secrets`, which stores values in the macOS Keychain, Linux Secret Service (libsecret), and Windows Credential Manager. PS-527 moves desktop and `pst serve` to it. Two gaps remain: a Linux host with no Secret Service, such as a headless server, and the hosted deployment provider.

## Temporary workaround

The local host uses a file-backed secret store under its private storage root (`<storage>/extension-connection-secrets/<ref>.secret`). It writes one credential per opaque reference with owner-only permissions where the operating system supports them. The database stores only the opaque reference. The API accepts an injected secret-store implementation so a production host can replace the file store. Today only the test app injects one (`packages/pstdio-api/src/test-utils/create-test-app.ts`); every other host falls back to the file store in `packages/pstdio-api/src/app-extension-services.ts`.

## Limitations

The file store keeps credentials out of repositories, workspaces, extension settings, extension child processes, logs, and database rows. It does not provide the account-backed protection of an operating-system keychain. Anyone who can read the Prompt Studio host account's private storage can read the credentials. That includes every process the user runs, backups of the storage folder, and other tools that run as the same user.

It also does not keep secrets away from extensions. Extension backends run inside the API process (ADR 0058). Any extension, or any npm dependency of one, can read these files, read the environment, and send the values out. A keychain alone does not fix this either, because code in the same process can call the same keychain API. Until ADR 0058 ships, installing an extension gives it the access of the user's account, and the docs say so.

## Isolation

The extension context exposes named request and stream operations. It does not expose secret references or secret bytes. This is an API boundary, not a security boundary: it does not stop extension code from reading the files directly.

The workaround stays in a few places. The connection service is the only code that reads and writes secrets. The composition root in `app-extension-services.ts` creates the file store when no store is injected, and `app-contracts.ts` declares the injection point. Tests use an in-memory implementation.

## Removal

Remove the file store when PS-527 ships the keychain store for desktop and `pst serve` and a decision exists for hosts without a keychain. Implement those providers behind the same interface, migrate existing opaque references and delete the secret files, then delete this ADR, ADR 0035, and the file-backed implementation after one release that can read and migrate the files.
