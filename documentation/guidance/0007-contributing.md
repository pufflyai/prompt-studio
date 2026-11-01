# Contributing

## 1. Git

1. Name branches `<category>/<kebab-description>`, using `feature`, `bugfix`, `hotfix`, `test`, or `chore`. Example: `feature/add-new-event-button`.
2. Use commit messages `<category>(<PS-XXX>): <statement>; <statement>`, with `feat`, `fix`, `refactor`, or `chore`. Each statement must finish “This commit will…”. Example: `fix(PS-42): add new button component; add new button to templates`.
3. Open PRs as drafts against `main` unless the user says otherwise.
4. Use PR titles `<category>(<PS-XXX>): <statement>`, such as `fix(PS-42): add new button component`.
5. Use the headings in the [PR template](../../.github/pull_request_template.md), in the same order. `gh pr create --body` replaces the template, so include the headings yourself.
6. Follow [PR and CI completion](0004-ci.md) through the latest commit.

## 2. Generated files

1. Never commit generated files except the approved exceptions in section 3. Generated files include build output, bundles, compiled previews, reports, snapshots, caches, and type stubs recreated by a command. Commit the source and command instead.
2. Before every commit, run `git status` and `git diff --cached --stat`.
3. Unstage generated files that are not exceptions. Remove them from the branch if already committed.
4. If a check fails because a generated file is missing or stale, report it instead of committing the file.
5. Adding an exception requires explicit user approval in the same conversation and an update to section 3.
6. Never commit the UI Canvas preview catalog. Canvas and CI build it from source. Content hashes can cascade through shared imports, changing hundreds of generated files and hiding the source change in review.

## 3. Generated-file exceptions

1. Commit `bun.lock` and `extensions/*/bun.lock` only when dependencies change. Sync extension lockfiles with `bun run --cwd scripts release:extension-lockfiles:sync`.
2. Commit migrations under `packages/pstdio-db/drizzle/**`, `services/account-manager/drizzle/**`, `services/relay/drizzle/**`, and `services/psx/drizzle/**` only for schema changes. Generate them with the package's `db:generate` script; follow section 6.
3. Only the Changesets release process writes committed `CHANGELOG.md` files and `package.json` versions. Feature PRs add `.changeset/*.md` files.
4. Commit `packages/pstdio-extensions/src/bridge/webview-runtime/runtime.bundle.js` only when its source in `packages/pstdio-extensions/src/bridge` changes. Rebuild it from that source.
5. Commit `extensions/harness-codex/src/protocol/**` only when the supported Codex app-server protocol changes. Copy these types from Codex's ts-rs output; do not edit them by hand.

## 4. Large changes

1. Changes adding 5,000 or more lines to a PR need human approval before writing code. This includes designs that commit the project to that much code later.
2. Count every added line, including lockfiles, translations, tests, copied code, generated output, and fixtures. This also covers designs that keep adding files with every change.
3. Stop before writing the code and create a decision request with `pst pstdio-planner request-human --request '{"kind":"decision"}'`.
4. Explain the expected size, why it is needed, and the smaller alternatives considered.
5. Wait for approval. Implement only after approval, and link the request in the PR description.
6. If the change grows past the limit while working, stop and request approval the same way. Check size with `git diff --shortstat origin/main...HEAD`.

## 5. Changesets

1. Apply these rules to changes compared with `main`, not changes made earlier on the same branch.
2. Changesets cover `pstdio`, `@pstdio/sdk`, `@pstdio/ui`, `@pstdio/workbench`, and every core extension.
3. For changes under `packages/*` other than SDK, UI, or workbench, add a changeset for `pstdio` only.
4. For SDK, UI, or workbench changes, include both `pstdio` and the changed package.
5. For extension source or asset changes, include that extension. Extension-only changesets must not bump the host or other extensions.
6. Add new private packages under `packages/` or `clients/` to `.changeset/config.json`'s `ignore` list.
7. Run `bun changeset`, select `patch`, `minor`, or `major`, and write a one-line changelog summary.
8. Never edit versions in `package.json` by hand.
9. Do not add changesets for changes that only affect tests or code structure.
10. The host, SDK, UI, workbench, and desktop share a fixed version group. Core extensions have independent versions and changelogs and stay outside it.
11. Extension PRs own their SDK and UI dependency ranges. See [independent extension releases](../guides/development/0013-independent-extension-releases.md).

## 6. Database migrations

1. Never create or edit Drizzle migration SQL by hand.
2. Change the schema source first, then generate the migration with the package script, such as `bun run --cwd packages/pstdio-db db:generate`.
3. If a generated migration is wrong, fix the schema or generation setup and generate it again.
4. A PR may contain only one migration entry. If the tools create more than one, combine them into one without editing generated SQL by hand.
