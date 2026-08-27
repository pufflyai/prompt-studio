# Desktop distribution and updates

Prompt Studio publishes desktop installers on the same GitHub release as the
matching `pstdio` runtime. A desktop application and its bundled sidecar always
share one version; mixing files from different releases is unsupported.

## Install

Choose the artifact for the computer that will run Prompt Studio:

| Platform | Install artifact | Alternative |
| --- | --- | --- |
| Apple Silicon macOS | `Prompt-Studio-<version>-darwin-arm64.dmg` | matching ZIP |
| Intel macOS | `Prompt-Studio-<version>-darwin-x64.dmg` | matching ZIP |
| Linux x64 | `Prompt-Studio-<version>-linux-x64.deb` | portable ZIP |

The Linux ZIP is portable rather than system-integrated. Extract it to a stable
directory, preserve executable permissions, and launch `Prompt Studio` from the
extracted directory. The DEB participates in the distribution's normal package
inventory.

## Verify a download

Each release includes `checksums-desktop-<version>.sha256` plus target-specific
checksum files. Run the platform's SHA-256 tool from the directory containing the
download and checksum file.

On macOS, Finder/Gatekeeper validates the notarized Developer ID application.
Operators can additionally run:

```bash
codesign --verify --deep --strict --verbose=2 "/Applications/Prompt Studio.app"
spctl --assess --type execute --verbose=2 "/Applications/Prompt Studio.app"
xcrun stapler validate "/Applications/Prompt Studio.app"
```

Windows desktop distribution is deferred until its trusted signing lane is
available. Do not distribute an unsigned development package as a release.

## Updates

Packaged macOS applications query the public GitHub Releases API for the newest
complete `pstdio@<version>` release. They then point Electron's native updater at
that release's architecture-aware JSON metadata. Source builds do not use the
native updater.

Electron has no built-in Linux updater. Use the package manager for DEB installs,
or download and replace the portable directory from the GitHub release page.
The desktop **Check for updates** capability opens that release page on Linux.

## Release ownership and secrets

The configured publication channel is this repository's `pstdio@<version>`
GitHub release. The release owner must approve this channel before the first
production publish. `.github/workflows/release-packages.yml` creates it as a draft and calls
`.github/workflows/release-desktop.yml`. Only the final publish job can write
release contents. Native build artifacts are retained by Actions for 14 days.

Repository administrators provision these GitHub Actions secrets:

| Secret | Purpose |
| --- | --- |
| `MACOS_CERTIFICATE` | Base64 PKCS#12 Developer ID Application certificate |
| `MACOS_CERTIFICATE_PASSWORD` | PKCS#12 password |
| `MACOS_SIGN_IDENTITY` | Exact Developer ID Application identity |
| `APPLE_API_KEY` | Base64 App Store Connect `.p8` notarization key |
| `APPLE_API_KEY_ID` | App Store Connect key ID |
| `APPLE_API_ISSUER` | App Store Connect issuer UUID |

`WINDOWS_CERTIFICATE` and `WINDOWS_CERTIFICATE_PASSWORD` remain optional workflow
inputs for the deferred Windows lane. They are not required for the active
macOS and Linux release set.

Credentials are decoded only into the native runner's temporary directory. The
macOS certificate is imported into an ephemeral keychain that is deleted even
when the job fails. Never print, upload, or commit decoded credentials.

## Release readiness evidence

Each native target launches the actual application produced by Forge after the
target's signing step. The packaged suite must prove all of the following before
the target artifacts are eligible for publication:

- a clean desktop-owned start reaches the dashboard within eight seconds and
  binds the sidecar to literal `127.0.0.1`;
- browser REST uses a renderer-inaccessible HttpOnly cookie, while the bundled
  CLI discovers the same runtime and uses descriptor bearer authentication;
- arbitrary browser origins and unauthenticated readiness requests are rejected,
  and the runtime credential is absent from HTML, URLs, and JavaScript cookies;
- `pst serve` promotes ownership without changing the runtime PID, closing the
  desktop detaches, and a warm relaunch reaches the same persistent runtime
  within three seconds with project data intact;
- `pst close` announces an intentional shutdown, removes the matching descriptor,
  and closes the connected desktop; and
- an injected sidecar exit displays recovery within 500 milliseconds, then Retry
  starts a replacement runtime in the existing Electron process.

The workflow uploads the Playwright JSON result as
`release-readiness-<platform>-<architecture>` with 14-day retention. A release
owner links the three native job runs and their evidence artifacts from the
ticket validation report. Contract tests in the owning packages separately
cover active-work refusal/confirmation, indefinite graceful wait, lock and bind
failures, corrupt PGlite recovery classification, exact instance targeting,
window/IPC restrictions, checksums, fuses, update metadata, and version drift.

A local unsigned run is useful implementation evidence, but it is not a
substitute for the three native workflow results. Never record 5/5 release
confidence until the signed and notarized macOS checks, Linux package inspection,
native packaged suites, and complete published release set all pass for the same
version.

## Release troubleshooting

- **Release remains a draft:** open the native matrix and identify the first
  failed target. The draft is the safety boundary; do not publish it manually.
- **Missing credential:** provision the exact secret named in the failure and
  rerun the desktop workflow for the existing version/tag.
- **macOS notarization or Gatekeeper failure:** verify the Developer ID identity,
  App Store Connect key permissions, Team ownership, timestamp service, and
  stapling result. Do not disable hardened runtime or signature validation.
- **Version or checksum drift:** regenerate the version PR and rebuild all native
  targets. Never edit an installer name, `RELEASES`, sidecar manifest, or checksum
  after verification.
- **Wrong architecture:** discard the artifact and download the explicitly named
  target. The application refuses to launch a mismatched sidecar.
