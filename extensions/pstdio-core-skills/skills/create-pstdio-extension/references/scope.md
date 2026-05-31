# Extension Scope

Choose the extension source location before scaffolding files:

- Use `<repoRoot>/.pstdio/extensions/<name>/` for behavior that belongs to one repository. This includes worktree bootstrap, status gates that run repo scripts, hooks that inspect repo-local files, and team-customized automation.
- Use `$PSTDIO_HOME/extensions/<name>/` or `~/.pstdio/extensions/<name>/` for behavior the user wants across projects.
- Use `extensions/<name>/` only for first-party bundled extensions in this monorepo.

Declare repo-owned behavior with `"pstdio": { "scope": "repo" }` in `package.json`. Omit `pstdio.scope`, or set it to `"user"`, for user-scoped extensions.

Repo-local extensions are discovered when the repo is linked to a project. They use the same manifest and `defineExtension()` API as user extensions, and a repo-local extension overrides a user extension with the same package id for that project.

When the request mentions hooks, plugins, repo checks, worktree setup, or commands such as `bun test`, prefer repo-local scope unless the user explicitly asks for a reusable personal extension.
