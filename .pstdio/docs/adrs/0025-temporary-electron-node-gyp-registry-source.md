# Temporary registry source for Electron node-gyp

Status: Accepted temporary workaround.

## Intended design

Electron Forge should resolve its build tools from published registry packages.
The lockfile should pin their versions and integrity hashes without a local override.

## External limitation

Forge 7.11.2 depends on `@electron/rebuild` 3.7.2, which requests
`@electron/node-gyp` from Git commit `06b29aafb7708acef8b3669835c8a7857ebc92d2`.
GitHub's tarball endpoint returned HTTP 5xx during CI runs 34569457775 and
34570640747. This failed clean dependency installs before tests started.
The current Forge release still requests that Git dependency.

## Temporary workaround

Override only `@electron/node-gyp` with registry version `10.2.0-electron.2`.
Its source commit, `0453f4fe4656c63277185b35feedec5716a27d90`, differs from
the requested commit only by changing the package version. No build-tool code changes.
Keep the exact version and registry integrity hash in Bun's lockfile.

This avoids the GitHub tarball endpoint while preserving the requested implementation.
It still depends on registry availability and adds a dependency override to maintain.
It does not add install retries or change any timeout.

## Isolation and removal

Keep the override at the workspace root. Do not patch Electron Forge or node-gyp.
Docker images separately install only their target workspace dependency graph.

Remove the override when a compatible Forge/rebuild release uses a registry package.
Regenerate the lockfile and validate cold installs and packaged desktop tests on Linux
and macOS before removing it.

## Evidence

- [Source comparison](https://github.com/electron/node-gyp/compare/06b29aafb7708acef8b3669835c8a7857ebc92d2...0453f4fe4656c63277185b35feedec5716a27d90).
- [Registry package](https://www.npmjs.com/package/@electron/node-gyp/v/10.2.0-electron.2).
- [Failed install](https://github.com/pufflyai/prompt-studio/actions/runs/34570640747/job/103171783640).
