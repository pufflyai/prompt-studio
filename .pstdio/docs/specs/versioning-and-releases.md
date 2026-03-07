# Versioning and Releases

Workspace packages are versioned and released using [Changesets](https://github.com/changesets/changesets). Each publishable package follows semver. Internal dependency bumps between workspace packages are handled automatically.

---

## Why

- **Monorepo-native.** Changesets tracks which packages changed and bumps their dependents automatically.
- **Explicit intent.** Contributors declare the bump type and changelog note alongside their code change, not at release time.
- **Automated releases.** A CI workflow opens a versioning PR on `main` and publishes to npm when that PR is merged.

---

## Contributor workflow

### 1. Add a changeset

After making changes to one or more publishable packages, run:

```sh
bun changeset
```

The interactive prompt asks:

1. Which packages changed.
2. The semver bump for each (`patch`, `minor`, `major`).
3. A changelog summary (one line).

This creates a `.changeset/<random-id>.md` file. Commit it with the PR.

### 2. Merge the PR

When the PR merges into `main`, CI detects pending changesets.

### 3. Version Packages PR

CI opens (or updates) a **Version Packages** PR that:

- Bumps `package.json` versions for affected packages.
- Bumps internal workspace dependency ranges.
- Appends entries to each package's `CHANGELOG.md`.
- Deletes consumed `.changeset/*.md` files.

### 4. Publish

When the Version Packages PR is merged, CI publishes every package whose version is not already on npm.

---

## What gets published

Only packages with `"private": false` (or no `"private"` field) in their `package.json` are published. Packages marked `"private": true` are excluded from npm publishing but still receive version bumps and changelog entries.

---

## Changeset configuration

The `.changeset/config.json` file controls behavior:

| Field | Value | Description |
| --- | --- | --- |
| `baseBranch` | `main` | Branch that triggers the release workflow. |
| `access` | `public` | Scoped packages are published as public. |
| `changelog` | `@changesets/cli/changelog` | Default changelog formatter. |

---

## CI workflow

A GitHub Actions workflow runs on every push to `main`:

1. Checks out the repo.
2. Sets up Bun.
3. Installs dependencies (`bun install`).
4. Runs `changesets/action`:
   - If pending changesets exist → opens or updates the Version Packages PR.
   - If no pending changesets and versions were just bumped → publishes to npm.

### Required secrets

| Secret | Purpose |
| --- | --- |
| `NPM_TOKEN` | Authenticates `npm publish`. |

### Required repository settings

- **Workflow permissions** → Read and write.
- **Allow GitHub Actions to create and approve pull requests** → Enabled.

---

## Version-only mode

To use the versioning PR without npm publishing, omit the `publish` input from the CI workflow. The Version Packages PR will still be created and version bumps will still be applied on merge.

---

## Errors

- `"No changesets found"`: no `.changeset/*.md` files exist. Run `bun changeset` to create one.
- `"Package <name> is private"`: the package has `"private": true` and was skipped during publish.
- `"Version <x.y.z> already exists on npm"`: the package version was already published. No action is taken for that package.
