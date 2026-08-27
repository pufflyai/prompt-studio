# ADR: Temporarily Defer the Windows Desktop Release

## Status

Temporary. Remove this decision when the Windows desktop release has a trusted
signing service, an owner, and native release evidence.

## Ideal design

The desktop release should build, sign, launch, verify, and publish every
declared platform from one fail-closed native matrix. Windows x64 should produce
a trusted Squirrel installer and update package alongside the signed and
notarized macOS artifacts and the Linux packages.

## External limitation

The repository does not have the trusted Windows code-signing credentials needed
to sign the application, bundled sidecar, and installer. Publishing Windows
unsigned would remove the publisher identity and signature checks required by
PS-3 and PS-219. Keeping Windows active would block the macOS and Linux release
lanes that can proceed now.

## Decision

Keep the Windows packaging, signing, artifact preparation, and updater code for
later, but remove `win32-x64` from the active desktop workflow matrix and the
required published release set. Make the two Windows workflow secrets optional
while the lane is disabled. Do not publish a Windows desktop artifact.

This decision does not change the separate Windows CLI build or the generic
Windows runtime support.

## Trade-offs

macOS and Linux can ship through the existing fail-closed publisher without an
unsigned Windows exception. The repository temporarily carries dormant Windows
desktop release code that CI does not execute, so it can drift until the lane is
restored.

## Isolation

The exception is limited to the active target list in
`clients/desktop/src/release/release-artifacts.ts`, the native matrix and secret
requirements in `.github/workflows/release-desktop.yml`, and documentation of
the declared release set. It adds no product setting, stored flag, unsigned
fallback, or alternate publisher.

## Removal

When trusted Windows signing and ownership are available:

1. Restore `win32-x64` to the active release target list and workflow matrix.
2. Make `WINDOWS_CERTIFICATE` and `WINDOWS_CERTIFICATE_PASSWORD` required again,
   or replace them with the selected managed-signing contract.
3. Run the Windows package on a native runner and verify Authenticode on the app,
   sidecar, and installer.
4. Prove the Squirrel update metadata against the approved GitHub release.
5. Update PS-3, PS-219, PS-220, and the desktop distribution documentation.
6. Remove or supersede this ADR only after the Windows lane passes with the other
   declared targets.
