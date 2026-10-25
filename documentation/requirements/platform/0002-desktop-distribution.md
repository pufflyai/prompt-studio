# PRD: Desktop distribution and updates

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
| Windows x64 | `Prompt-Studio-<version>-win32-x64-Setup.exe` | — |

On macOS, open the DMG. Its window shows the app, an arrow, and the Applications
folder. Drag the app onto Applications. Finder copies it. It may show a
progress window, and it shows its own replace prompt or error when needed. The
window itself does not change after the
drop. When the copy finishes, open Applications and launch Prompt Studio from
there, not from the DMG. After the person creates their first project in the app
launched from Applications, the app links `/usr/local/bin/pst` to its bundled
runtime. The first launch asks for nothing. When the directory needs an
administrator password, the app first explains why, then asks **Install** or
**Not Now**. Only **Install** opens the macOS password window, which
shows the app's reason under the title "osascript wants to make changes." Choosing
**Not Now** or cancelling the password window leaves the app usable and does not
ask again. Choose **Prompt Studio → Install pst Command…** to
install later or restore a removed link.
Apps running from the DMG or another unpacked folder do not install the command.

The app's `bin` folder holds the runtime and a `pst` link to it on macOS and Linux.
The desktop app puts that folder first on the runtime's `PATH`, and agents inherit
it, so they can run `pst` even when the terminal command is missing. Agents run
commands in login shells. On macOS, a login shell moves `/usr/local/bin` ahead of
the app's folder, so a different `pst` installed there takes priority.

The Linux DEB installs `/usr/bin/pst` and removes its own link when uninstalled.
The Windows Setup installer creates a `pst.cmd` launcher in the installation's
stable `bin` folder and adds that folder to the current user's `PATH`. Setup does
not require an administrator password. Close and reopen your terminal after installation,
then run `pst --version`. The launcher follows the new bundled runtime on every
Squirrel update. Uninstall removes the desktop-owned launcher and its PATH entry.
Other PATH entries, including environment-variable references, are preserved.
Windows release availability still depends on the signing lane described below.

None of these installers requires Bun, Node.js, or a separate CLI download.
Desktop updates keep `pst` on the matching bundled runtime.

Existing commands are preserved. Remove a separate CLI installation before
retrying setup to use the desktop's bundled version. A command earlier on a custom
`PATH` takes priority; run `command -v pst` on macOS/Linux or `where.exe pst` on
Windows to check which one runs. Deleting the
macOS app leaves its link behind; remove that link with `rm /usr/local/bin/pst`
(use `sudo` if needed).

The Linux ZIP is portable rather than system-integrated. Extract it to a stable
directory without spaces, preserve executable permissions, and launch
`prompt-studio` from the extracted directory. Electron's SUID sandbox currently
cannot launch an executable whose full path contains spaces. The DEB installs
under its normal system path and participates in the distribution's package
inventory. See [the temporary path restriction](../../adrs/0019-temporary-linux-desktop-package-paths.md).

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

On Windows, run the Setup installer. Its verified publisher is **Pufflig AB**.
The application, bundled runtime, installer, and update payload carry trusted
Authenticode signatures and timestamps. To inspect the downloaded installer:

```powershell
Get-FileHash .\Prompt-Studio-VERSION-win32-x64-Setup.exe -Algorithm SHA256
Get-AuthenticodeSignature .\Prompt-Studio-VERSION-win32-x64-Setup.exe |
  Format-List Status, SignerCertificate, TimeStamperCertificate
```

Require `Valid` and compare the hash with the release's checksum file. Do not
distribute an unsigned development package as a supported desktop release.

## Updates

Packaged macOS and Windows applications query the public GitHub Releases API for the newest
complete `pstdio@<version>` release on their [update channel](#update-channels). They then point Electron's native updater at
that release's architecture-aware JSON metadata on macOS, or its `RELEASES` and
full nupkg files on Windows. Source builds do not use the
native updater. A check compares the published version with the installed desktop
version before downloading. Equal or older releases are not downloaded.

The app checks in the background after the runtime starts and every four hours.
A background check stays silent unless an update finished downloading, and then
shows the ready-to-install dialog once for that version. Failed background checks
are only logged as `desktop.update.background.failed`.

**Prompt Studio → Check for Updates…** shows a native dialog for each result:

| Result | Feedback |
| --- | --- |
| No newer version | **You're up to date.**, with the installed version |
| Download verified and complete | **Your update is ready to install.**, with the downloaded version and instructions to quit and reopen |
| New version starts after a downloaded update | **Prompt Studio was updated successfully.**, with the running desktop version; shown once |
| Lookup, download, or verification fails | **Prompt Studio couldn't complete the update.**, with retry and log guidance |

Dismiss these dialogs with **OK**. A downloaded update is installed when the app
quits normally. Reopening runs the new version. The existing active-work
confirmation still applies to quitting; downloading does not stop work.

The desktop keeps the downloaded version in its application support directory
until a later launch can confirm the matching version is running. First launches
and launches where the update was not installed do not show an installation
success message. Updating the desktop bundle does not replace an independently
running persistent CLI runtime.

Electron has no built-in Linux updater. Use the package manager for DEB installs,
or download and replace the portable directory from the GitHub release page.
The desktop **Check for updates** capability opens the newest release page with a
Linux package for the chosen channel when that release is newer than the running
app. Otherwise it shows **You're up to date.** Background checks do nothing on Linux.

## Update channels

Packaged macOS and Linux apps follow one of two channels. Windows apps and source
builds always follow stable and offer no choice.

| Channel | Releases offered |
| --- | --- |
| `stable` (default) | Published releases that are neither drafts nor prereleases, by GitHub flag or semver |
| `nightly` | The same, plus published `-nightly.` prereleases; the highest semver wins |

A stable release such as `0.43.0` ranks above every `0.43.0-nightly.*` build, so
the nightly channel moves to it. The app never offers a version that is not newer
than the running one. Switching from nightly back to stable therefore keeps the
nightly build until a newer stable release exists. Downgrading would run an older
app on a database that newer migrations already changed.

The channel is a device setting in `PSTDIO_HOME/desktop/update-channel.json`, not
runtime data, so a remote runtime cannot move this app to nightly. The desktop app
reads it before every check. People change it in **Settings → Workbench →
Update channel**, which calls the `getUpdateChannel` and `setUpdateChannel`
desktop bridge calls. Agents use `pst update-channel [stable|nightly]`, which
writes the same file. Changing the channel in the app starts a background check
right away. See [Versioning and releases](0005-versioning-and-releases.md#nightly-builds)
for how nightlies are built and pruned.

## Release ownership and secrets

The configured publication channel is this repository's `pstdio@<version>`
GitHub release. The release owner must approve this channel before the first
production publish. `.github/workflows/release-packages.yml` calls
`.github/workflows/release-desktop.yml` to build and verify the native artifacts,
then its publish job creates the release and attaches them after every release
check passed. Only that publish job can write release contents. Native build
artifacts are retained by Actions for 14 days.

Repository administrators provision these GitHub Actions secrets:

| Secret | Purpose |
| --- | --- |
| `MACOS_CERTIFICATE` | Base64 PKCS#12 Developer ID Application certificate |
| `MACOS_CERTIFICATE_PASSWORD` | PKCS#12 password |
| `MACOS_SIGN_IDENTITY` | Exact Developer ID Application identity |
| `APPLE_API_KEY` | Base64 App Store Connect `.p8` notarization key |
| `APPLE_API_KEY_ID` | App Store Connect key ID |
| `APPLE_API_ISSUER` | App Store Connect issuer UUID |

Windows uses Azure Artifact Signing with GitHub OIDC. The private key stays in
Azure; no `.pfx` file or client secret is needed. The account, Public Trust profile,
endpoint, and Azure identity IDs are repository Actions variables. See
[Windows signing setup](../../../clients/desktop/docs/windows-signing.md).
All six Azure variables are required for Windows releases. The release workflow
must run from the authorized `main` branch, even when it checks out a release tag.

Credentials are decoded only into the native runner's temporary directory. The
macOS certificate is imported into an ephemeral keychain that is deleted even
when the job fails. Never print, upload, or commit decoded credentials.

## Release verification evidence

Each native target launches the actual application produced by Forge after the
target's signing step. The packaged suite must prove all of the following before
the target artifacts are eligible for publication:

- a clean desktop-owned start reaches the dashboard within eight seconds and
  binds the sidecar to literal `127.0.0.1`;
- the workbench signs in through a single-use, short-lived login link and then
  sends its browser session secret as a bearer header. The secret lives in the
  runtime origin's `localStorage`, and the runtime sets no cookies
  ([ADR 0057](../../adrs/0057-browser-sessions-in-per-origin-storage.md)). The
  bundled CLI discovers the same runtime and sends the descriptor's runtime token
  as its bearer credential;
- arbitrary browser origins and unauthenticated readiness requests are rejected,
  the runtime token is absent from HTML and URLs, and `document.cookie` is empty;
- `pst serve` promotes ownership without changing the runtime PID, closing the
  desktop detaches, and a warm relaunch reaches the same persistent runtime
  within three seconds with project data and the selected workbench resource
  intact;
- `pst close` announces an intentional shutdown, removes the matching descriptor,
  and closes the connected desktop;
- an unexpected backend exit gets one automatic recovery attempt in the existing
  Electron process, including when desktop attached to a CLI-started backend.
  The restarting view appears within 500 milliseconds; and
- an injected exit of that replacement displays recovery within 500 milliseconds,
  then Retry starts another runtime in the same Electron process. Live but
  unreachable owners and intentional shutdowns never trigger automatic replacement.

Startup, recovery, and renderer budgets run as packaged benchmarks in a separate
step before the packaged suite ([ADR 0067](../../adrs/0067-separate-performance-budgets-from-execution-allowances.md)).
Hosted Intel macOS runners are slow and costly. The Intel target runs only the
benchmark and packaged tests tagged `@essential`. They prove the clean start, both
transport paths, `pst close`, and a terminal and extension page in the x64 build.
The Intel clean start may take up to 28 seconds. The other targets run the full
suites.

The workflow uploads the Playwright JSON results as
`test-results-desktop-<platform>-<architecture>` with 14-day retention. A release
owner links every native job run and their evidence artifacts from the
ticket validation report. Contract tests in the owning packages separately
cover active-work refusal/confirmation, indefinite graceful wait, lock and bind
failures, corrupt PGlite recovery classification, exact instance targeting,
window/IPC restrictions, checksums, fuses, update metadata, and version drift.

A local unsigned run is useful implementation evidence, but it is not a
substitute for both native workflow results. Never record 5/5 release
confidence until the signed and notarized macOS checks, Linux package inspection,
native packaged suites, and complete published release set all pass for the same
version.

## Release troubleshooting

- **Release remains unpublished:** open the Release Packages run and identify the
  first failed target. Nothing is published until every check passes; do not
  publish manually. Re-run the failed jobs for a flake, or merge a fix to `main`.
- **Missing credential:** provision the exact secret named in the failure and
  re-run the failed jobs of the release run.
- **macOS notarization or Gatekeeper failure:** verify the Developer ID identity,
  App Store Connect key permissions, Team ownership, timestamp service, and
  stapling result. Do not disable hardened runtime or signature validation.
- **Version or checksum drift:** regenerate the version PR and rebuild all native
  targets. Never edit an installer name, `RELEASES`, sidecar manifest, or checksum
  after verification.
- **Wrong architecture:** discard the artifact and download the explicitly named
  target. The application refuses to launch a mismatched sidecar.

## Local runtime and account authentication

The checks above cover the local runtime credential only. The private account
manager (#1146 and #1163) is a separate authority. It signs people in with Google
through Better Auth and issues finite environment access for a relay. A runtime
uses that access only when a relay connection file is configured, and the desktop
release suite does not exercise it. See [account authority
development](../../guides/development/0007-account-manager.md).

## Delivery record

Checked on 2026-10-18 against main commit `45580feb`. The newest stable release is
`pstdio@0.43.1`, published on 2026-10-14.

| Field | Record |
| --- | --- |
| Status | Released. |
| Implementation | `clients/desktop`, `.github/workflows/release-desktop.yml`, and the publish job in `.github/workflows/release-packages.yml`. Origin-scoped browser sessions came in #941. Release gating came in #1031, the nightly channel in #1018, and backend exit recovery in #1159. |
| Availability | The `pstdio@0.43.1` release has signed DMG, ZIP, DEB, Setup EXE, nupkg, `RELEASES`, and checksum assets for all four targets. #941 shipped in `pstdio@0.42.0`. #1159 is in the nightly `pstdio@0.44.0-nightly.20261018030230` only. That nightly has no Windows desktop assets, as designed. |
| Remaining work | Manual Windows validation of native agent sessions, as listed in [cross-platform support](0001-cross-platform-support.md#known-issues). |
| Evidence | GitHub release assets checked on 2026-10-18. Browser session checks: `clients/desktop/src/e2e/packaged-app.p1.spec.ts` and `desktop-app.p1.spec.ts` (release workflow and full CI stage, not rerun here), and `clients/desktop/src/security/runtime-session.p0.test.ts` plus `packages/pstdio-api/src/features/runtime/runtime-auth.p0.test.ts`, which passed locally on 2026-10-18. Signing and notarization evidence lives in the release runs, not in this record. |
