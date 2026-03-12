---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# Product Requirements Document: CLI Update (Draft)

## Summary

This PRD captures the proposed pstdio update behavior. The command remains draft and is not currently implemented in the CLI command tree.

## Detailed Behavior


Status: **DRAFT** (not implemented)

This command is not currently registered in the pstdio CLI command tree. This PRD describes proposed future behavior.

## Purpose

Define the proposed behavior for updating the pstdio CLI to a newer version. The updater is source-aware: it detects how pstdio was installed and delegates to the appropriate update mechanism.

---

## Install Source Detection

At install time, pstdio records the install source in `~/.pstdio/install-meta.json`:

```json
{
  "source": "homebrew" | "script" | "manual",
  "version": "1.2.3",
  "installedAt": "2026-03-07T12:00:00Z"
}
```

The source determines how `pstdio update` behaves.

---

## Usage

```sh
pstdio update [flags]
```

### Flags

| Flag          | Description                                              | Default    |
| ------------- | -------------------------------------------------------- | ---------- |
| `--check`     | Check for updates without installing.                    | `false`    |
| `--to`        | Install a specific version (e.g. `--to v1.3.0`).        | latest     |
| `--channel`   | Release channel: `stable` or `prerelease`.               | `stable`   |
| `--yes`       | Skip confirmation prompt.                                | `false`    |

---

## Behavior by Install Source

### Homebrew

pstdio does not self-mutate when installed via Homebrew. Homebrew formulae should not upgrade themselves.

- `pstdio update --check` prints the latest available version and whether an update is available.
- `pstdio update` prints instructions to run `brew upgrade pstdio` and exits. It does not perform the upgrade itself.

### Direct Install (script)

The updater fetches release metadata from GitHub Releases, verifies the asset, and replaces the binary.

**Steps:**

1. Fetch the latest release metadata from the GitHub Releases API (`/repos/:owner/:repo/releases/latest`).
2. Compare the current version against the release tag. If up to date, print `"Already on the latest version (vX.Y.Z)."` and exit.
3. Select the correct asset for the current OS and architecture.
4. Download the asset to a temporary path.
5. Verify the SHA256 digest against the value published in the release manifest.
6. Rename the current binary to `pstdio.bak` (one rollback copy).
7. Atomically move the new binary into place.
8. Update `~/.pstdio/install-meta.json` with the new version.
9. Print `"Updated pstdio from vX.Y.Z to vA.B.C."`.

If `--to` is provided, fetch that specific release tag instead of latest.

If `--channel prerelease` is provided, include prereleases when resolving the latest version.

### Manual

If the source is `manual` or unknown, print:

```
pstdio was installed manually. Download the latest release from:
https://github.com/<owner>/<repo>/releases/latest
```

---

## Integrity and Provenance

Release assets are published as immutable GitHub Releases with the following guarantees:

- Each release includes a `checksums.txt` file listing SHA256 digests for every asset.
- Release assets are verified using `SHA256` digest comparison after download.
- GitHub Release attestations provide tamper-resistant provenance. When available, the updater verifies the attestation using `gh attestation verify`.
- If digest verification fails, the update is aborted and the existing binary is left untouched. The error message includes the expected and actual digests.

---

## macOS Signing and Notarization

macOS binaries are signed and notarized in CI to avoid Gatekeeper warnings.

### Signing

- Binaries are signed with a **Developer ID Application** certificate.
- Installer packages (`.pkg`) are signed with a **Developer ID Installer** certificate.
- A secure timestamp is included (`--timestamp`).
- Nested code items are signed individually (no `--deep`).

### Notarization

- The notary service is invoked via `notarytool` with App Store Connect API keys.
- The notarization result is awaited with `--wait`.
- After notarization, the stapler attaches the ticket to the `.pkg` or `.dmg`.

### Artifact Formats

| Channel        | Format                                    | Purpose                        |
| -------------- | ----------------------------------------- | ------------------------------ |
| Direct install | Notarized `.pkg` (primary), raw binary    | Human installs, self-update    |
| Homebrew       | Raw binary referenced by formula          | Managed by Homebrew            |

---

## Rollback

If the new binary fails to start after update, the user can restore the previous version:

```sh
mv ~/.pstdio/bin/pstdio.bak ~/.pstdio/bin/pstdio
```

Only one rollback copy is kept. Each successful update overwrites the previous backup.

---

## Output Examples

### Check only

```
$ pstdio update --check
Current version: v1.2.3
Latest version:  v1.3.0
Run `pstdio update` to install.
```

### Already up to date

```
$ pstdio update
Already on the latest version (v1.3.0).
```

### Successful update (direct install)

```
$ pstdio update
Downloading pstdio v1.3.0 for darwin-arm64...
Verifying integrity... OK
Updated pstdio from v1.2.3 to v1.3.0.
```

### Homebrew install

```
$ pstdio update
pstdio was installed via Homebrew. Run:
  brew upgrade pstdio
```

### Digest mismatch

```
$ pstdio update
Downloading pstdio v1.3.0 for darwin-arm64...
Verifying integrity... FAILED
  Expected: sha256:abc123...
  Actual:   sha256:def456...
Update aborted. The existing binary was not modified.
```
