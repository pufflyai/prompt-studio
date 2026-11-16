# Temporary Forge ZIP reader override for Node 26

Proposed: 2026-11-16

Status: Accepted for the Node 26 nightly repair.

## Decision

Pin the transitive `yauzl` ZIP reader to 3.4.0 while Electron Forge 7 uses `extract-zip` 2.0.1, whose dependency range selects yauzl 2.10.0. Bun owns installation and locking. Development, CI and release tooling use Node 26.7.0.

## How it should work

The desktop packaging dependencies should support the selected Node release and finish extraction before reporting success. A successful build must produce a verifiable application.

## External limitation

The old ZIP reader's custom stream destruction does not complete under current Node stream semantics. Packaging with Node 26.7.0 stops while extracting Electron and exits zero without an app. The same source produces an app under Node 24.22.1. Upstream yauzl 3.3.1 fixed the read-stream lifecycle; 3.4.0 contains that fix. See [yauzl issue 169](https://github.com/thejoshwolfe/yauzl/issues/169) and [Electron issue 51619](https://github.com/electron/electron/issues/51619).

## Workaround and trade-offs

The override replaces the obsolete reader without migrating Forge's makers and signing APIs in this release repair. `extract-zip` uses the reader's normal open and entry APIs, not the custom RandomAccessReader extension changed by yauzl 3. The complete Electron archive and resulting app remain subject to extraction, package integrity, fuse, signing and notarization checks.

## Limitations

The override crosses yauzl's major version range and must be checked against actual Electron extraction and desktop packaging on the release platforms. It does not replace the Node runtime embedded inside Electron or third-party GitHub Actions.

## Removal

Remove the override when the selected Forge/Packager dependency uses a ZIP reader that contains the stream lifecycle fix. Verify Node 26 extraction, packaging and the release artifact checks before removing it.
